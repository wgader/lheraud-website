document.addEventListener('DOMContentLoaded', () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 1024;
    const cursor = document.getElementById('cursor');
    const videoEl = document.getElementById('bg-video');

    // ─── Signature Mask Path Length Dynamic Calculation ───────────
    const maskPath = document.getElementById('mask-path');
    const maskStem = document.getElementById('mask-stem');
    const accentPath = document.getElementById('accent-path');

    const WRITE_SPEED = 750; // pixels per second — uniform across all paths
    const BASE_DELAY = 0.8;  // seconds before first stroke begins

    const startSignatureAnimation = () => {
        if (maskPath) {
            const mainLength = maskPath.getTotalLength();
            maskPath.style.strokeDasharray = mainLength;
            maskPath.style.strokeDashoffset = mainLength;
            const mainDuration = mainLength / WRITE_SPEED;
            maskPath.style.animation = 'writeHand ' + mainDuration.toFixed(2) + 's linear ' + BASE_DELAY + 's forwards';

            // Chain the d-stem animation to start right when the main path ends
            if (maskStem) {
                const stemLength = maskStem.getTotalLength();
                maskStem.style.strokeDasharray = stemLength;
                maskStem.style.strokeDashoffset = stemLength;
                const stemDuration = stemLength / WRITE_SPEED;
                const stemDelay = BASE_DELAY + mainDuration;
                maskStem.style.animation = 'writeHand ' + stemDuration.toFixed(2) + 's linear ' + stemDelay.toFixed(2) + 's forwards';
            }

            // Accent appears at ~50% of main path (during é writing, not at the end)
            if (accentPath) {
                const accentLength = accentPath.getTotalLength();
                accentPath.style.strokeDasharray = accentLength;
                accentPath.style.strokeDashoffset = accentLength;
                const accentDelay = BASE_DELAY + mainDuration * 0.50;
                accentPath.style.animation = 'writeAccent 0.35s cubic-bezier(0.25, 1, 0.5, 1) ' + accentDelay.toFixed(2) + 's forwards';
            }
        }
    };

    // Delay the signature animation until the video actually starts playing
    if (videoEl) {
        if (!videoEl.paused && videoEl.currentTime > 0) {
            startSignatureAnimation();
        } else {
            videoEl.addEventListener('playing', startSignatureAnimation, { once: true });
        }
    } else {
        startSignatureAnimation();
    }

    // ─── Mouse ─────────────────────────────────────────────────────
    let mouseX = -300, mouseY = -300;
    let cx = -300, cy = -300;
    let cw = 280, ch = 160;

    // ─── Reveal state ──────────────────────────────────────────────
    let revealState = 'idle';
    let revealProgress = 0;
    let revealAnchorX = 0;
    let revealAnchorY = 0;
    let revealInitHalfW = 0;

    const OPEN_SPEED = 0.02;

    // ─── Utils ─────────────────────────────────────────────────────
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOut = t => 1 - Math.pow(1 - t, 4);
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    // ─── Events ────────────────────────────────────────────────────
    let grainFrame = 0;

    // ─── WebGL Setup for Fluid Distortion ──────────────────────────
    const canvasWebGL = document.getElementById('webgl-canvas');
    let gl = null;
    let webglActive = false;

    // Fluid FBOs
    let densityFBO, velocityFBO, pressureFBO, divergenceFBO, curlFBO;

    // Shader Programs
    let splatProgram, advectProgram, curlProgram, vorticityProgram, divProgram, pressureProgram, gradSubProgram, compositeProgram, clearProgram;

    // WebGL Textures
    let videoTexture = null;
    let textTexture = null;

    // Text caching and rendering canvas
    const textCanvas = document.createElement('canvas');
    const textCtx = textCanvas.getContext('2d');
    const originalStyles = new Map();

    // Mouse and splat tracking
    let splatStack = [];
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouseMoved = false;
    let currentProgram = null;
    let logCount = 0;

    if (canvasWebGL && videoEl) {
        gl = canvasWebGL.getContext('webgl') || canvasWebGL.getContext('experimental-webgl');
        if (gl && !isMobile) {
            webglActive = true;
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

            // Keep video in place but make it invisible and pointer-events none
            // This ensures iOS Safari treats it as onscreen and autoplays it
            videoEl.style.position = 'absolute';
            videoEl.style.top = '0';
            videoEl.style.left = '0';
            videoEl.style.width = '100%';
            videoEl.style.height = '100%';
            videoEl.style.opacity = '0.0001';
            videoEl.style.pointerEvents = 'none';

            // Shared Vertex Shader
            const vsSource = `
                attribute vec2 position;
                varying vec2 vUv;
                varying vec2 vL;
                varying vec2 vR;
                varying vec2 vT;
                varying vec2 vB;
                uniform vec2 texelSize;
                void main() {
                    vUv = position * 0.5 + 0.5;
                    vL = vUv - vec2(texelSize.x, 0.0);
                    vR = vUv + vec2(texelSize.x, 0.0);
                    vT = vUv + vec2(0.0, texelSize.y);
                    vB = vUv - vec2(0.0, texelSize.y);
                    gl_Position = vec4(position, 0.0, 1.0);
                }
            `;

            // Splat FS
            const splatSource = `
                precision highp float;
                varying vec2 vUv;
                uniform sampler2D uTarget;
                uniform float aspectRatio;
                uniform vec3 uColor;
                uniform vec2 uPointer;
                uniform float uRadius;
                void main() {
                    vec2 p = vUv - uPointer.xy;
                    p.x *= aspectRatio;
                    vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
                    vec3 base = texture2D(uTarget, vUv).xyz;
                    gl_FragColor = vec4(base + splat, 1.0);
                }
            `;

            // Advection FS
            const advectSource = `
                precision highp float;
                varying vec2 vUv;
                uniform sampler2D uVelocity;
                uniform sampler2D uSource;
                uniform vec2 texelSize;
                uniform float dt;
                uniform float uDissipation;
                void main() {
                    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
                    gl_FragColor = uDissipation * texture2D(uSource, coord);
                    gl_FragColor.a = 1.0;
                }
            `;

            // Curl FS
            const curlSource = `
                precision highp float;
                varying vec2 vL;
                varying vec2 vR;
                varying vec2 vT;
                varying vec2 vB;
                uniform sampler2D uVelocity;
                void main() {
                    float L = texture2D(uVelocity, vL).y;
                    float R = texture2D(uVelocity, vR).y;
                    float T = texture2D(uVelocity, vT).x;
                    float B = texture2D(uVelocity, vB).x;
                    float vorticity = R - L - T + B;
                    gl_FragColor = vec4(vorticity, 0.0, 0.0, 1.0);
                }
            `;

            // Vorticity Confinement FS
            const vorticitySource = `
                precision highp float;
                varying vec2 vUv;
                varying vec2 vL;
                varying vec2 vR;
                varying vec2 vT;
                varying vec2 vB;
                uniform sampler2D uVelocity;
                uniform sampler2D uCurl;
                uniform float uCurlValue;
                uniform float dt;
                void main() {
                    float L = texture2D(uCurl, vL).x;
                    float R = texture2D(uCurl, vR).x;
                    float T = texture2D(uCurl, vT).x;
                    float B = texture2D(uCurl, vB).x;
                    float C = texture2D(uCurl, vUv).x;
                    vec2 force = vec2(abs(T) - abs(B), abs(R) - abs(L)) * 0.5;
                    force /= length(force) + 0.0001;
                    force *= uCurlValue * C;
                    force.y *= -1.0;
                    vec2 vel = texture2D(uVelocity, vUv).xy;
                    gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
                }
            `;

            // Divergence FS
            const divergenceSource = `
                precision highp float;
                varying vec2 vUv;
                varying vec2 vL;
                varying vec2 vR;
                varying vec2 vT;
                varying vec2 vB;
                uniform sampler2D uVelocity;
                void main() {
                    float L = texture2D(uVelocity, vL).x;
                    float R = texture2D(uVelocity, vR).x;
                    float T = texture2D(uVelocity, vT).y;
                    float B = texture2D(uVelocity, vB).y;
                    vec2 C = texture2D(uVelocity, vUv).xy;
                    if (vL.x < 0.0) L = -C.x;
                    if (vR.x > 1.0) R = -C.x;
                    if (vT.y > 1.0) T = -C.y;
                    if (vB.y < 0.0) B = -C.y;
                    float div = 0.5 * (R - L + T - B);
                    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
                }
            `;

            // Clear FS
            const clearSource = `
                precision highp float;
                varying vec2 vUv;
                uniform sampler2D uTexture;
                uniform float uClearValue;
                void main() {
                    gl_FragColor = uClearValue * texture2D(uTexture, vUv);
                }
            `;

            // Pressure FS
            const pressureSource = `
                precision highp float;
                varying vec2 vUv;
                varying vec2 vL;
                varying vec2 vR;
                varying vec2 vT;
                varying vec2 vB;
                uniform sampler2D uPressure;
                uniform sampler2D uDivergence;
                void main() {
                    float L = texture2D(uPressure, vL).x;
                    float R = texture2D(uPressure, vR).x;
                    float T = texture2D(uPressure, vT).x;
                    float B = texture2D(uPressure, vB).x;
                    float divergence = texture2D(uDivergence, vUv).x;
                    float pressure = (L + R + B + T - divergence) * 0.25;
                    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
                }
            `;

            // Gradient Subtract FS
            const gradSubSource = `
                precision highp float;
                varying vec2 vUv;
                varying vec2 vL;
                varying vec2 vR;
                varying vec2 vT;
                varying vec2 vB;
                uniform sampler2D uPressure;
                uniform sampler2D uVelocity;
                void main() {
                    float L = texture2D(uPressure, vL).x;
                    float R = texture2D(uPressure, vR).x;
                    float T = texture2D(uPressure, vT).x;
                    float B = texture2D(uPressure, vB).x;
                    vec2 velocity = texture2D(uVelocity, vUv).xy;
                    velocity.xy -= vec2(R - L, T - B);
                    gl_FragColor = vec4(velocity, 0.0, 1.0);
                }
            `;

            // Composite FS
            const compositeSource = `
                precision highp float;
                varying vec2 vUv;
                uniform sampler2D tFluid;
                uniform sampler2D u_video;
                uniform sampler2D u_text;
                uniform vec2 u_resolution;
                uniform float uDistort;
                uniform float uReveal;
                uniform float u_video_aspect;
                void main() {
                    vec3 fluidColor = texture2D(tFluid, vUv).rgb;
                    vec2 distortedUv = vUv - fluidColor.rg * uDistort * 0.001;
                    distortedUv = clamp(distortedUv, 0.001, 0.999);
                    
                    float screenAspect = u_resolution.x / u_resolution.y;
                    vec2 videoUv = distortedUv;
                    if (screenAspect > u_video_aspect) {
                        videoUv.y = (videoUv.y - 0.5) * (u_video_aspect / screenAspect) + 0.5;
                    } else {
                        videoUv.x = (videoUv.x - 0.5) * (screenAspect / u_video_aspect) + 0.5;
                    }
                    videoUv = clamp(videoUv, 0.001, 0.999);
                    
                    vec4 videoColor = texture2D(u_video, videoUv);
                    
                    float gray = dot(videoColor.rgb, vec3(0.299, 0.587, 0.114));
                    vec3 bgColor = vec3(0.059, 0.051, 0.082); // #0F0D15
                    vec3 darkGraded = bgColor + vec3(gray) * bgColor * 1.8;
                    darkGraded += videoColor.rgb * vec3(0.06, 0.04, 0.02) * (1.0 - gray);
                    
                    vec4 textCol = texture2D(u_text, distortedUv);
                    
                    vec4 colorFull = mix(videoColor, textCol, textCol.a);
                    vec4 colorDark = mix(vec4(darkGraded, 1.0), textCol * 0.8, textCol.a);
                    
                    float fluidStrength = length(fluidColor.rg);
                    float reveal = smoothstep(0.005, 0.15, fluidStrength);
                    float activeReveal = max(reveal, uReveal);
                    
                    vec4 finalColor = mix(colorDark, colorFull, activeReveal);
                    
                    gl_FragColor = finalColor;
                }
            `;

            function compileShader(gl, source, type) {
                const shader = gl.createShader(type);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                    gl.deleteShader(shader);
                    return null;
                }
                return shader;
            }

            function createProgram(vsSource, fsSource) {
                const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
                const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
                const program = gl.createProgram();
                gl.attachShader(program, vs);
                gl.attachShader(program, fs);
                gl.bindAttribLocation(program, 0, "position");
                gl.linkProgram(program);
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                    console.error('Program link error:', gl.getProgramInfoLog(program));
                }
                return program;
            }

            let textureType = gl.UNSIGNED_BYTE;
            let extHalf = gl.getExtension('OES_texture_half_float');
            let extHalfLinear = gl.getExtension('OES_texture_half_float_linear');
            gl.getExtension('EXT_color_buffer_half_float');
            let extFloat = gl.getExtension('OES_texture_float');
            let extFloatLinear = gl.getExtension('OES_texture_float_linear');
            gl.getExtension('WEBGL_color_buffer_float');

            if (extHalf && extHalfLinear) {
                textureType = extHalf.HALF_FLOAT_OES;
            } else if (extFloat && extFloatLinear) {
                textureType = gl.FLOAT;
            }

            function createFBO(w, h, format, type, filter) {
                const frameBuffer = gl.createFramebuffer();
                gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, format, type, null);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
                return { texture, frameBuffer, width: w, height: h };
            }

            function createDoubleFBO(w, h, format, type, filter) {
                let fbo1 = createFBO(w, h, format, type, filter);
                let fbo2 = createFBO(w, h, format, type, filter);
                return {
                    get read() { return fbo1; },
                    get write() { return fbo2; },
                    swap() {
                        let temp = fbo1;
                        fbo1 = fbo2;
                        fbo2 = temp;
                    },
                    destroy() {
                        gl.deleteTexture(fbo1.texture);
                        gl.deleteFramebuffer(fbo1.frameBuffer);
                        gl.deleteTexture(fbo2.texture);
                        gl.deleteFramebuffer(fbo2.frameBuffer);
                    }
                };
            }

            function initFBOs() {
                try {
                    densityFBO = createDoubleFBO(512, 512, gl.RGBA, textureType, gl.LINEAR);
                    velocityFBO = createDoubleFBO(128, 128, gl.RGBA, textureType, gl.LINEAR);
                    pressureFBO = createDoubleFBO(128, 128, gl.RGBA, textureType, gl.NEAREST);
                    divergenceFBO = createFBO(128, 128, gl.RGBA, textureType, gl.NEAREST);
                    curlFBO = createFBO(128, 128, gl.RGBA, textureType, gl.NEAREST);
                } catch (e) {
                    textureType = gl.UNSIGNED_BYTE;
                    densityFBO = createDoubleFBO(512, 512, gl.RGBA, textureType, gl.LINEAR);
                    velocityFBO = createDoubleFBO(128, 128, gl.RGBA, textureType, gl.LINEAR);
                    pressureFBO = createDoubleFBO(128, 128, gl.RGBA, textureType, gl.NEAREST);
                    divergenceFBO = createFBO(128, 128, gl.RGBA, textureType, gl.NEAREST);
                    curlFBO = createFBO(128, 128, gl.RGBA, textureType, gl.NEAREST);
                }
            }

            initFBOs();

            function clearFBO(fbo) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.frameBuffer);
                gl.viewport(0, 0, fbo.width, fbo.height);
                gl.clearColor(0.0, 0.0, 0.0, 0.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
            function clearDoubleFBO(doubleFBO) {
                clearFBO(doubleFBO.read);
                clearFBO(doubleFBO.write);
            }
            clearDoubleFBO(densityFBO);
            clearDoubleFBO(velocityFBO);
            clearDoubleFBO(pressureFBO);
            clearFBO(divergenceFBO);
            clearFBO(curlFBO);

            splatProgram = createProgram(vsSource, splatSource);
            advectProgram = createProgram(vsSource, advectSource);
            curlProgram = createProgram(vsSource, curlSource);
            vorticityProgram = createProgram(vsSource, vorticitySource);
            divProgram = createProgram(vsSource, divergenceSource);
            pressureProgram = createProgram(vsSource, pressureSource);
            gradSubProgram = createProgram(vsSource, gradSubSource);
            compositeProgram = createProgram(vsSource, compositeSource);
            clearProgram = createProgram(vsSource, clearSource);

            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            const positions = new Float32Array([
                -1, -1,
                1, -1,
                -1, 1,
                -1, 1,
                1, -1,
                1, 1,
            ]);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

            videoTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, videoTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([15, 13, 21, 255]));
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            textTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, textTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            const elementsToDraw = document.querySelectorAll(
                '.hero__welcome, .hero__title-line, .hero__subtitle, .hero__divider'
            );
            elementsToDraw.forEach(el => {
                const style = window.getComputedStyle(el);
                originalStyles.set(el, {
                    color: style.color,
                    fontFamily: style.fontFamily,
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight,
                    letterSpacing: style.letterSpacing,
                    textTransform: style.textTransform,
                    backgroundColor: style.backgroundColor
                });
            });

            document.body.classList.add('is-webgl-active');

            function useProgram(program) {
                gl.useProgram(program);
                currentProgram = program;
            }

            function bindTexture(program, name, texture, unit) {
                const loc = gl.getUniformLocation(program, name);
                if (loc !== null) {
                    gl.activeTexture(gl.TEXTURE0 + unit);
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.uniform1i(loc, unit);
                }
            }

            function blit(targetFBO) {
                if (targetFBO) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO.frameBuffer);
                    gl.viewport(0, 0, targetFBO.width, targetFBO.height);
                } else {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                }
                const texelSizeLoc = gl.getUniformLocation(currentProgram, 'texelSize');
                if (texelSizeLoc && targetFBO) {
                    gl.uniform2f(texelSizeLoc, 1.0 / targetFBO.width, 1.0 / targetFBO.height);
                }
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }

            function updateTextCanvas() {
                const w = window.innerWidth;
                const h = window.innerHeight;
                if (textCanvas.width !== w || textCanvas.height !== h) {
                    textCanvas.width = w;
                    textCanvas.height = h;
                }
                textCtx.clearRect(0, 0, w, h);

                const canvasRect = canvasWebGL.getBoundingClientRect();
                const canvasTop = canvasRect.top;

                elementsToDraw.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden') {
                        return;
                    }
                    const cached = originalStyles.get(el) || {};

                    const adjustedTop = rect.top - canvasTop;
                    const adjustedBottom = rect.bottom - canvasTop;

                    if (el.classList.contains('hero__divider')) {
                        textCtx.fillStyle = cached.backgroundColor || '#dbcebc';
                        textCtx.fillRect(rect.left, adjustedTop, rect.width, rect.height);
                    } else {
                        let text = el.innerText || el.textContent;
                        if (cached.textTransform === 'uppercase') {
                            text = text.toUpperCase();
                        }

                        const fontSize = style.fontSize;
                        const fontWeight = cached.fontWeight || 'normal';
                        const fontFamily = cached.fontFamily || 'sans-serif';
                        textCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;

                        const isHovered = el.matches(':hover');

                        if (el.classList.contains('hero__cta')) {
                            textCtx.fillStyle = isHovered ? '#ffffff' : (cached.color || '#dbcebc');
                            textCtx.textAlign = 'center';
                            textCtx.textBaseline = 'top';

                            const textX = rect.left + rect.width / 2;
                            textCtx.fillText(text, textX, adjustedTop);

                            const lineY = adjustedBottom - 2;
                            textCtx.strokeStyle = isHovered ? '#ffffff' : (cached.color || '#dbcebc');
                            textCtx.lineWidth = 1;
                            textCtx.beginPath();
                            textCtx.moveTo(rect.left, lineY);
                            textCtx.lineTo(rect.right, lineY);
                            textCtx.stroke();

                            textCtx.lineWidth = 3;
                            textCtx.beginPath();
                            const accentWidth = isHovered ? rect.width * 0.65 : rect.width * 0.3;
                            const accentLeft = rect.left + (rect.width - accentWidth) / 2;
                            textCtx.moveTo(accentLeft, lineY);
                            textCtx.lineTo(accentLeft + accentWidth, lineY);
                            textCtx.stroke();
                        } else {
                            textCtx.fillStyle = cached.color || '#ffffff';
                            const textAlign = style.textAlign || 'left';
                            textCtx.textAlign = textAlign;
                            textCtx.textBaseline = 'top';

                            if (cached.letterSpacing && cached.letterSpacing !== 'normal') {
                                textCtx.letterSpacing = cached.letterSpacing;
                            } else {
                                textCtx.letterSpacing = '0px';
                            }

                            let x = rect.left;
                            if (textAlign === 'center') {
                                x = rect.left + rect.width / 2;
                            } else if (textAlign === 'right') {
                                x = rect.right;
                            }
                            textCtx.fillText(text, x, adjustedTop);
                        }
                    }
                });
            }

            function resizeCanvas() {
                const dpr = window.devicePixelRatio || 1;
                canvasWebGL.width = window.innerWidth * dpr;
                canvasWebGL.height = window.innerHeight * dpr;
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
        } else {
            canvasWebGL.style.display = 'none';
        }

        // Setup video play handlers so it always autoplays and resumes, even on mobile
        const playVideo = () => {
            if (videoEl) {
                videoEl.muted = true;
                videoEl.defaultMuted = true;
                videoEl.play().catch(e => console.log("Video play deferred:", e));
            }
        };
        playVideo();
        document.addEventListener('mousemove', playVideo, { once: true });
        document.addEventListener('click', playVideo, { once: true });
        document.addEventListener('touchstart', playVideo, { once: true });
    }

    // ─── Grain Canvas Setup ──────────────────────────────────────
    const grainCanvas = document.getElementById('grain-canvas');
    let grainCtx = null;
    let grainImageData = null;

    if (grainCanvas) {
        grainCtx = grainCanvas.getContext('2d');
        grainCanvas.width = 256;
        grainCanvas.height = 256;
        grainImageData = grainCtx.createImageData(256, 256);
    }

    // ─── Particles Setup ──────────────────────────────────────────
    const canvas = document.getElementById('particles-canvas');
    let ctx = null;
    let particles = [];

    if (canvas) {
        ctx = canvas.getContext('2d');
        function initParticles() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            particles = [];
            for (let i = 0; i < 70; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radius: Math.random() * 1.5 + 0.5,
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: Math.random() * -0.5 - 0.1,
                    alpha: Math.random() * 0.5 + 0.1
                });
            }
        }
        initParticles();
        window.addEventListener('resize', initParticles);
    }

    document.addEventListener('mousemove', (e) => {
        if (webglActive) {
            const x = e.clientX;
            const y = e.clientY;
            if (!mouseMoved) {
                mouseMoved = true;
                lastMouseX = x;
                lastMouseY = y;
            } else {
                const dx = x - lastMouseX;
                const dy = y - lastMouseY;
                lastMouseX = x;
                lastMouseY = y;
                splatStack.push({
                    x: x / window.innerWidth,
                    y: 1.0 - (y / window.innerHeight),
                    dx: dx * 1.1,
                    dy: -dy * 1.1
                });
            }
        }

        mouseX = e.clientX;
        mouseY = e.clientY;
        if (cursor && cursor.style.opacity !== '1') {
            cursor.style.opacity = '1';
        }
    });

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            mouseX = touch.clientX;
            mouseY = touch.clientY;
            if (cursor && cursor.style.opacity !== '1') {
                cursor.style.opacity = '1';
            }
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            if (webglActive) {
                const x = touch.clientX;
                const y = touch.clientY;
                if (!mouseMoved) {
                    mouseMoved = true;
                    lastMouseX = x;
                    lastMouseY = y;
                } else {
                    const dx = x - lastMouseX;
                    const dy = y - lastMouseY;
                    lastMouseX = x;
                    lastMouseY = y;
                    splatStack.push({
                        x: x / window.innerWidth,
                        y: 1.0 - (y / window.innerHeight),
                        dx: dx * 1.1,
                        dy: -dy * 1.1
                    });
                }
            }
            mouseX = touch.clientX;
            mouseY = touch.clientY;
            if (cursor && cursor.style.opacity !== '1') {
                cursor.style.opacity = '1';
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        if (window.scrollY > 300) return;

        if (revealState === 'idle' || revealState === 'closing') {
            revealAnchorX = mouseX;
            revealAnchorY = mouseY;
            revealInitHalfW = cw / 2;
            revealState = 'opening';
            revealProgress = 0;
        } else {
            revealAnchorX = mouseX;
            revealAnchorY = mouseY;
            revealState = 'closing';
        }
    });

    // ─── Render loop ───────────────────────────────────────────────
    function render() {
        const w = W(), h = H();

        let tx = mouseX, ty = mouseY;
        let tw = 240, th = 240;

        cx = lerp(cx, tx, 0.05);
        cy = lerp(cy, ty, 0.05);
        cw = lerp(cw, tw, 0.05);
        ch = lerp(ch, th, 0.05);

        let holeW = cw, holeH = ch;
        let holeX = cx, holeY = cy;

        const maxHalfW = Math.max(revealAnchorX, w - revealAnchorX) + 60;

        if (revealState === 'opening') {
            revealProgress = Math.min(1, revealProgress + OPEN_SPEED);
            const e = easeOut(revealProgress);

            holeW = lerp(cw, maxHalfW * 2, e);
            holeX = lerp(revealAnchorX, w / 2, e);

            const eY = Math.min(1, revealProgress * 4);
            holeH = lerp(ch, h * 1.5, eY);
            holeY = lerp(revealAnchorY, h / 2, eY);

            if (revealProgress >= 1) {
                revealState = 'open';
                document.body.classList.add('is-revealed');
            }
        } else if (revealState === 'open') {
            holeW = w * 1.5;
            holeH = h * 1.5;
            holeX = w / 2;
            holeY = h / 2;
        } else if (revealState === 'closing') {
            document.body.classList.remove('is-revealed');
            revealProgress = Math.max(0, revealProgress - OPEN_SPEED);
            const e = easeOut(revealProgress);

            holeW = lerp(cw, maxHalfW * 2, e);
            holeX = lerp(cx, revealAnchorX, e);

            const eY = Math.min(1, revealProgress * 4);
            holeH = lerp(ch, h * 1.5, eY);
            holeY = lerp(cy, revealAnchorY, eY);

            if (revealProgress <= 0) {
                revealState = 'idle';
            }
        }

        if (webglActive && mouseX !== -300) {
            const time = performance.now() * 0.0035;
            const wobbleX = Math.sin(time * 2.0) * 1.5;
            const wobbleY = Math.cos(time * 2.5) * 1.5;
            splatStack.push({
                x: (mouseX + wobbleX) / w,
                y: 1.0 - ((mouseY + wobbleY) / h),
                dx: wobbleX * 0.15,
                dy: wobbleY * 0.15
            });
        }

        if (webglActive) {
            updateTextCanvas();
            gl.bindTexture(gl.TEXTURE_2D, textTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);

            if (videoEl.readyState >= 2) {
                gl.bindTexture(gl.TEXTURE_2D, videoTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
            }

            let videoAspect = 16.0 / 9.0;
            if (videoEl.videoWidth && videoEl.videoHeight) {
                videoAspect = videoEl.videoWidth / videoEl.videoHeight;
            }

            useProgram(splatProgram);
            gl.uniform1f(gl.getUniformLocation(splatProgram, 'aspectRatio'), w / h);
            gl.uniform1f(gl.getUniformLocation(splatProgram, 'uRadius'), 0.003);

            while (splatStack.length > 0) {
                const splat = splatStack.shift();

                bindTexture(splatProgram, 'uTarget', velocityFBO.read.texture, 0);
                gl.uniform2f(gl.getUniformLocation(splatProgram, 'uPointer'), splat.x, splat.y);
                gl.uniform3f(gl.getUniformLocation(splatProgram, 'uColor'), splat.dx, splat.dy, 0.0);
                blit(velocityFBO.write);
                velocityFBO.swap();

                gl.uniform3f(gl.getUniformLocation(splatProgram, 'uColor'), 0.639, 0.549, 0.424);
                bindTexture(splatProgram, 'uTarget', densityFBO.read.texture, 0);
                blit(densityFBO.write);
                densityFBO.swap();
            }

            useProgram(advectProgram);
            gl.uniform1f(gl.getUniformLocation(advectProgram, 'dt'), 0.016);

            gl.uniform1f(gl.getUniformLocation(advectProgram, 'uDissipation'), 1.0);
            bindTexture(advectProgram, 'uVelocity', velocityFBO.read.texture, 0);
            bindTexture(advectProgram, 'uSource', velocityFBO.read.texture, 1);
            blit(velocityFBO.write);
            velocityFBO.swap();

            gl.uniform1f(gl.getUniformLocation(advectProgram, 'uDissipation'), 0.96);
            bindTexture(advectProgram, 'uVelocity', velocityFBO.read.texture, 0);
            bindTexture(advectProgram, 'uSource', densityFBO.read.texture, 1);
            blit(densityFBO.write);
            densityFBO.swap();

            useProgram(curlProgram);
            bindTexture(curlProgram, 'uVelocity', velocityFBO.read.texture, 0);
            blit(curlFBO);

            useProgram(vorticityProgram);
            gl.uniform1f(gl.getUniformLocation(vorticityProgram, 'dt'), 0.016);
            gl.uniform1f(gl.getUniformLocation(vorticityProgram, 'uCurlValue'), 1.9);
            bindTexture(vorticityProgram, 'uVelocity', velocityFBO.read.texture, 0);
            bindTexture(vorticityProgram, 'uCurl', curlFBO.texture, 1);
            blit(velocityFBO.write);
            velocityFBO.swap();

            useProgram(divProgram);
            bindTexture(divProgram, 'uVelocity', velocityFBO.read.texture, 0);
            blit(divergenceFBO);

            useProgram(clearProgram);
            gl.uniform1f(gl.getUniformLocation(clearProgram, 'uClearValue'), 0.80);
            bindTexture(clearProgram, 'uTexture', pressureFBO.read.texture, 0);
            blit(pressureFBO.write);
            pressureFBO.swap();

            useProgram(pressureProgram);
            bindTexture(pressureProgram, 'uDivergence', divergenceFBO.texture, 1);
            for (let i = 0; i < 4; i++) {
                bindTexture(pressureProgram, 'uPressure', pressureFBO.read.texture, 0);
                blit(pressureFBO.write);
                pressureFBO.swap();
            }

            useProgram(gradSubProgram);
            bindTexture(gradSubProgram, 'uPressure', pressureFBO.read.texture, 0);
            bindTexture(gradSubProgram, 'uVelocity', velocityFBO.read.texture, 1);
            blit(velocityFBO.write);
            velocityFBO.swap();

            useProgram(compositeProgram);
            bindTexture(compositeProgram, 'tFluid', densityFBO.read.texture, 0);
            bindTexture(compositeProgram, 'u_video', videoTexture, 1);
            bindTexture(compositeProgram, 'u_text', textTexture, 2);
            gl.uniform2f(gl.getUniformLocation(compositeProgram, 'u_resolution'), canvasWebGL.width, canvasWebGL.height);
            gl.uniform1f(gl.getUniformLocation(compositeProgram, 'uDistort'), 0.40);
            gl.uniform1f(gl.getUniformLocation(compositeProgram, 'uReveal'), revealProgress);
            gl.uniform1f(gl.getUniformLocation(compositeProgram, 'u_video_aspect'), videoAspect);
            blit(null);

            if (cursor) {
                cursor.style.boxShadow = 'none';
                cursor.style.border = 'none';
                cursor.style.backgroundColor = 'transparent';
                cursor.style.backdropFilter = 'none';
                cursor.style.webkitBackdropFilter = 'none';
                cursor.style.borderRadius = '0%';
            }
        } else if (!webglActive && cursor) {
            cursor.style.borderRadius = ((1 - revealProgress) * 50) + '%';
        }

        if (cursor) {
            cursor.style.width = holeW + 'px';
            cursor.style.height = holeH + 'px';
            cursor.style.transform = `translate3d(${holeX - holeW / 2}px, ${holeY - holeH / 2}px, 0)`;
        }

        const shouldHideCursor = isMobile || (window.scrollY > 300) || (revealState === 'open') || (revealState === 'opening');
        if (cursor) {
            if (shouldHideCursor) {
                cursor.style.display = 'none';
                document.body.style.cursor = 'auto';
                if (!isMobile) {
                    document.querySelectorAll('a, button, .timeline__item, .hero__coords-btn').forEach(el => el.style.cursor = 'pointer');
                }
            } else {
                cursor.style.display = 'flex';
                document.body.style.cursor = 'none';
                document.querySelectorAll('a, button, .timeline__item, .hero__coords-btn').forEach(el => el.style.cursor = 'none');
            }
        }

        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.y < 0) {
                    p.y = canvas.height;
                    p.x = Math.random() * canvas.width;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(197, 164, 126, ${p.alpha})`;
                ctx.fill();
            });
        }

        grainFrame++;
        if (grainFrame % 2 === 0 && grainCtx && grainImageData && grainEnabled) {
            const data = grainImageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const v = (Math.random() * 255) | 0;
                data[i] = v; data[i + 1] = v; data[i + 2] = v;
                data[i + 3] = 4;
            }
            grainCtx.putImageData(grainImageData, 0, 0);
        }

        requestAnimationFrame(render);
    }

    const filmGrain = document.querySelector('.film-grain');
    let grainEnabled = true;
    if (filmGrain) {
        filmGrain.style.opacity = '1';
    }

    // ─── Scroll Effects ───────────────────────────────────────────
    const heroContent = document.querySelector('.hero__content');
    const heroFooter = document.querySelector('.hero__footer');
    const particlesEl = document.getElementById('particles-canvas');
    const timelineEl = document.querySelector('.vertical-timeline');
    const grainEl = document.getElementById('grain-canvas');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const hideThreshold = 300;

        if (heroContent) {
            const opacity = Math.max(0, 1 - (scrollY / 400));
            heroContent.style.opacity = opacity;
            heroContent.style.transform = `translateY(${scrollY * 0.15}px)`;
        }

        if (heroFooter) {
            const opacity = Math.max(0, 1 - (scrollY / 200));
            heroFooter.style.opacity = opacity;
        }

        const shouldHide = scrollY > hideThreshold;

        if (particlesEl) particlesEl.classList.toggle('is-hidden', shouldHide);
        if (timelineEl) timelineEl.classList.toggle('is-hidden', shouldHide);

        if (grainEl) {
            grainEl.style.opacity = shouldHide ? '0' : '1';
        }

        const header = document.querySelector('.header');
        if (header) {
            const menuOverlay = document.getElementById('menu-overlay');
            const isMenuOpen = menuOverlay ? menuOverlay.classList.contains('menu-overlay--open') : false;
            header.classList.toggle('has-bg', scrollY > 50 || revealState === 'open' || isMenuOpen);
        }
    });

    render();
});
