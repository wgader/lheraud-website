document.addEventListener('DOMContentLoaded', () => {
    const cursor = document.getElementById('cursor');

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
    const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    // ─── Events ────────────────────────────────────────────────────
    let idleTime = 0;
    let grainFrame = 0;

    // ─── WebGL Setup for Fluid Distortion ──────────────────────────
    const canvasWebGL = document.getElementById('webgl-canvas');
    const videoEl = document.getElementById('bg-video');
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

    // textCanvas remains off-screen (not appended to DOM)

    // Mouse and splat tracking
    let splatStack = [];
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouseMoved = false;
    let currentProgram = null;
    let logCount = 0;

    if (canvasWebGL && videoEl) {
        gl = canvasWebGL.getContext('webgl') || canvasWebGL.getContext('experimental-webgl');
        if (gl) {
            webglActive = true;
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

            // Hide fallback video off-screen so browser continues decoding it
            videoEl.style.position = 'fixed';
            videoEl.style.top = '-1000px';
            videoEl.style.left = '-1000px';
            videoEl.style.width = '320px';
            videoEl.style.height = '180px';
            videoEl.style.opacity = '0.01';
            videoEl.style.pointerEvents = 'none';

            // Shared Vertex Shader (computes neighbor coords for simulation passes)
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

            // Pressure (Jacobi) FS
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

            // Composite FS (distorts video + text canvas, reveals color video inside fluid)
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
                    vec3 bgColor = vec3(0.059, 0.051, 0.082); // #0F0D15 (Navy Dark)
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
                gl.bindAttribLocation(program, 0, "position"); // Lock quad vertices to index 0
                gl.linkProgram(program);
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                    console.error('Program link error:', gl.getProgramInfoLog(program));
                }
                return program;
            }

            // Detect best precision type
            let textureType = gl.UNSIGNED_BYTE;
            
            // Try to enable float/half-float extensions
            let extHalf = gl.getExtension('OES_texture_half_float');
            let extHalfLinear = gl.getExtension('OES_texture_half_float_linear');
            gl.getExtension('EXT_color_buffer_half_float'); // Enable half-float rendering if available
            
            let extFloat = gl.getExtension('OES_texture_float');
            let extFloatLinear = gl.getExtension('OES_texture_float_linear');
            gl.getExtension('WEBGL_color_buffer_float'); // Enable float rendering if available

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

                    // Check completeness on density and velocity FBOs
                    gl.bindFramebuffer(gl.FRAMEBUFFER, densityFBO.read.frameBuffer);
                    const status1 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFBO.read.frameBuffer);
                    const status2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

                    if (status1 !== gl.FRAMEBUFFER_COMPLETE || status2 !== gl.FRAMEBUFFER_COMPLETE) {
                        throw new Error("FBO incomplete status");
                    }
                    console.log("WebGL FBOs initialized successfully with textureType:", textureType);
                } catch (e) {
                    console.warn("FBO creation failed with type:", textureType, "- falling back to UNSIGNED_BYTE. Error:", e.message);
                    
                    // Clean up FBOs
                    if (densityFBO && typeof densityFBO.destroy === 'function') densityFBO.destroy();
                    if (velocityFBO && typeof velocityFBO.destroy === 'function') velocityFBO.destroy();
                    if (pressureFBO && typeof pressureFBO.destroy === 'function') pressureFBO.destroy();
                    if (divergenceFBO) {
                        gl.deleteTexture(divergenceFBO.texture);
                        gl.deleteFramebuffer(divergenceFBO.frameBuffer);
                    }
                    if (curlFBO) {
                        gl.deleteTexture(curlFBO.texture);
                        gl.deleteFramebuffer(curlFBO.frameBuffer);
                    }

                    // Force fallback
                    textureType = gl.UNSIGNED_BYTE;
                    densityFBO = createDoubleFBO(512, 512, gl.RGBA, textureType, gl.LINEAR);
                    velocityFBO = createDoubleFBO(128, 128, gl.RGBA, textureType, gl.LINEAR);
                    pressureFBO = createDoubleFBO(128, 128, gl.RGBA, textureType, gl.NEAREST);
                    divergenceFBO = createFBO(128, 128, gl.RGBA, textureType, gl.NEAREST);
                    curlFBO = createFBO(128, 128, gl.RGBA, textureType, gl.NEAREST);
                    console.log("WebGL FBOs successfully fallback-initialized with UNSIGNED_BYTE");
                }
            }

            initFBOs();

            // Clear FBOs to avoid uninitialized garbage values/NaN propagation
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

            // Compile shaders
            splatProgram = createProgram(vsSource, splatSource);
            advectProgram = createProgram(vsSource, advectSource);
            curlProgram = createProgram(vsSource, curlSource);
            vorticityProgram = createProgram(vsSource, vorticitySource);
            divProgram = createProgram(vsSource, divergenceSource);
            pressureProgram = createProgram(vsSource, pressureSource);
            gradSubProgram = createProgram(vsSource, gradSubSource);
            compositeProgram = createProgram(vsSource, compositeSource);
            clearProgram = createProgram(vsSource, clearSource);

            // Setup fullscreen quad buffer
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

            // Setup Video and Text Textures
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

            // Cache original CSS styles before they get set to transparent (excluding the CTA button so it's not distorted)
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

            // Enable is-webgl-active style override only after original colors are safely cached!
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

                elementsToDraw.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden') {
                        return;
                    }
                    const cached = originalStyles.get(el) || {};

                    if (el.classList.contains('hero__divider')) {
                        textCtx.fillStyle = cached.backgroundColor || '#dbcebc';
                        textCtx.fillRect(rect.left, rect.top, rect.width, rect.height);
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
                            textCtx.fillText(text, textX, rect.top);

                            const lineY = rect.bottom - 2;
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
                            if (logCount < 10) {
                                console.log("Drawing text:", text, "at", x, rect.top, "color:", textCtx.fillStyle, "font:", textCtx.font, "rect:", rect.left, rect.top, rect.width, rect.height);
                            }
                            textCtx.fillText(text, x, rect.top);
                        }
                    }
                });
                if (logCount < 10) {
                    logCount++;
                }
            }

            function resizeCanvas() {
                const dpr = window.devicePixelRatio || 1;
                canvasWebGL.width = window.innerWidth * dpr;
                canvasWebGL.height = window.innerHeight * dpr;
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            // Ensure video attempts to play immediately, and add user activity listeners to bypass autoplay blocks
            const playVideo = () => {
                videoEl.play().catch(e => console.log("Video play deferred:", e));
            };
            playVideo();
            document.addEventListener('mousemove', playVideo, { once: true });
            document.addEventListener('click', playVideo, { once: true });
            document.addEventListener('touchstart', playVideo, { once: true });
        } else {
            canvasWebGL.style.display = 'none';
        }
    }

    // ─── Grain Canvas Setup ──────────────────────────────────────
    const grainCanvas = document.getElementById('grain-canvas');
    let grainCtx = null;
    let grainImageData = null;

    if (grainCanvas) {
        grainCtx = grainCanvas.getContext('2d');
        // Use a small resolution for performance (will be stretched by CSS)
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
                    vy: Math.random() * -0.5 - 0.1, // Float up
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
        idleTime = 0;
        if (cursor.style.opacity !== '1') {
            cursor.style.opacity = '1';
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
            idleTime = 0;
            if (cursor.style.opacity !== '1') {
                cursor.style.opacity = '1';
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;

        // Only trigger reveal click when looking at the hero section (scrolled less than 300px from top)
        if (window.scrollY > 300) return;

        if (revealState === 'idle' || revealState === 'closing') {
            revealAnchorX = mouseX;
            revealAnchorY = mouseY;
            revealInitHalfW = cw / 2;
            revealState = 'opening';
            revealProgress = 0;
        } else {
            // Re-activate unrevealed dark state
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

        // LERP "Ultra Smooth" (Encore plus lent et cinématographique)
        cx = lerp(cx, tx, 0.05);
        cy = lerp(cy, ty, 0.05);
        cw = lerp(cw, tw, 0.05);
        ch = lerp(ch, th, 0.05);

        // Hide corners during reveal (fallback mode only)
        // const cornersVisible = revealState === 'idle' && !webglActive;
        // corners.forEach(c => c.style.opacity = cornersVisible ? '1' : '0');

        // ── Compute reveal hole ───────────────────────────────────
        let holeW = cw, holeH = ch;
        let holeX = cx, holeY = cy;

        const maxHalfW = Math.max(revealAnchorX, w - revealAnchorX) + 60;

        if (revealState === 'opening') {
            revealProgress = Math.min(1, revealProgress + OPEN_SPEED);
            const e = easeOut(revealProgress);

            holeW = lerp(cw, maxHalfW * 2, e);
            // Glide reveal center smoothly from click point to screen center to prevent jumps/bugs on edge clicks
            holeX = lerp(revealAnchorX, w / 2, e);

            const eY = Math.min(1, revealProgress * 4);
            holeH = lerp(ch, h * 1.5, eY);
            holeY = lerp(revealAnchorY, h / 2, eY);

            if (revealProgress >= 1) {
                revealState = 'open';
                document.body.classList.add('is-revealed');

                // Film grain stays active on reveal as requested
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
            // Glide center smoothly back to current mouse
            holeX = lerp(cx, revealAnchorX, e);

            const eY = Math.min(1, revealProgress * 4);
            holeH = lerp(ch, h * 1.5, eY);
            holeY = lerp(cy, revealAnchorY, eY);

            if (revealProgress <= 0) {
                revealState = 'idle';
            }
        }

        // Continuous organic wobble when mouse is active but stationary
        if (webglActive && mouseX !== -300) {
            const time = performance.now() * 0.0035;
            // Generate tiny smooth movements in circles/spirals
            const wobbleX = Math.sin(time * 2.0) * 1.5;
            const wobbleY = Math.cos(time * 2.5) * 1.5;
            splatStack.push({
                x: (mouseX + wobbleX) / w,
                y: 1.0 - ((mouseY + wobbleY) / h),
                dx: wobbleX * 0.15,
                dy: wobbleY * 0.15
            });
        }

        // Apply WebGL scene update and draw
        if (webglActive) {
            // Step 1: Update text canvas and upload texture
            updateTextCanvas();
            gl.bindTexture(gl.TEXTURE_2D, textTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);

            // Step 2: Update video texture
            if (videoEl.readyState >= 2) {
                gl.bindTexture(gl.TEXTURE_2D, videoTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
            }

            // Video aspect ratio
            let videoAspect = 16.0 / 9.0;
            if (videoEl.videoWidth && videoEl.videoHeight) {
                videoAspect = videoEl.videoWidth / videoEl.videoHeight;
            }

            // Step 3: Run interaction splats (splat Stack)
            useProgram(splatProgram);
            gl.uniform1f(gl.getUniformLocation(splatProgram, 'aspectRatio'), w / h);
            gl.uniform1f(gl.getUniformLocation(splatProgram, 'uRadius'), 0.003); // radius: 0.3 / 100.0 = 0.003

            while (splatStack.length > 0) {
                const splat = splatStack.shift();

                // 1. Splat velocity
                bindTexture(splatProgram, 'uTarget', velocityFBO.read.texture, 0);
                gl.uniform2f(gl.getUniformLocation(splatProgram, 'uPointer'), splat.x, splat.y);
                gl.uniform3f(gl.getUniformLocation(splatProgram, 'uColor'), splat.dx, splat.dy, 0.0);
                blit(velocityFBO.write);
                velocityFBO.swap();

                // 2. Splat density (with gold color tint for the fluid)
                gl.uniform3f(gl.getUniformLocation(splatProgram, 'uColor'), 0.639, 0.549, 0.424); // #A38C6C (Gold)
                bindTexture(splatProgram, 'uTarget', densityFBO.read.texture, 0);
                blit(densityFBO.write);
                densityFBO.swap();
            }

            // Step 4: Advection (advect velocity and density)
            useProgram(advectProgram);
            gl.uniform1f(gl.getUniformLocation(advectProgram, 'dt'), 0.016);

            // Advect velocity
            gl.uniform1f(gl.getUniformLocation(advectProgram, 'uDissipation'), 1.0); // velocity dissipation: 1.0
            bindTexture(advectProgram, 'uVelocity', velocityFBO.read.texture, 0);
            bindTexture(advectProgram, 'uSource', velocityFBO.read.texture, 1);
            blit(velocityFBO.write);
            velocityFBO.swap();

            // Advect density
            gl.uniform1f(gl.getUniformLocation(advectProgram, 'uDissipation'), 0.96); // density dissipation: 0.96
            bindTexture(advectProgram, 'uVelocity', velocityFBO.read.texture, 0);
            bindTexture(advectProgram, 'uSource', densityFBO.read.texture, 1);
            blit(densityFBO.write);
            densityFBO.swap();

            // Step 5: Curl
            useProgram(curlProgram);
            bindTexture(curlProgram, 'uVelocity', velocityFBO.read.texture, 0);
            blit(curlFBO);

            // Step 6: Vorticity Confinement
            useProgram(vorticityProgram);
            gl.uniform1f(gl.getUniformLocation(vorticityProgram, 'dt'), 0.016);
            gl.uniform1f(gl.getUniformLocation(vorticityProgram, 'uCurlValue'), 1.9); // curl: 1.9
            bindTexture(vorticityProgram, 'uVelocity', velocityFBO.read.texture, 0);
            bindTexture(vorticityProgram, 'uCurl', curlFBO.texture, 1);
            blit(velocityFBO.write);
            velocityFBO.swap();

            // Step 7: Divergence
            useProgram(divProgram);
            bindTexture(divProgram, 'uVelocity', velocityFBO.read.texture, 0);
            blit(divergenceFBO);

            // Step 8: Clear pressure FBO
            useProgram(clearProgram);
            gl.uniform1f(gl.getUniformLocation(clearProgram, 'uClearValue'), 0.80); // pressure reduction: 0.80
            bindTexture(clearProgram, 'uTexture', pressureFBO.read.texture, 0);
            blit(pressureFBO.write);
            pressureFBO.swap();

            // Step 9: Jacobi solver for pressure (Solve Poisson equation)
            useProgram(pressureProgram);
            bindTexture(pressureProgram, 'uDivergence', divergenceFBO.texture, 1);
            for (let i = 0; i < 4; i++) { // swirl: 4
                bindTexture(pressureProgram, 'uPressure', pressureFBO.read.texture, 0);
                blit(pressureFBO.write);
                pressureFBO.swap();
            }

            // Step 10: Gradient Subtract
            useProgram(gradSubProgram);
            bindTexture(gradSubProgram, 'uPressure', pressureFBO.read.texture, 0);
            bindTexture(gradSubProgram, 'uVelocity', velocityFBO.read.texture, 1);
            blit(velocityFBO.write);
            velocityFBO.swap();

            // Step 11: Final Composite render to screen canvas!
            useProgram(compositeProgram);
            bindTexture(compositeProgram, 'tFluid', densityFBO.read.texture, 0);
            bindTexture(compositeProgram, 'u_video', videoTexture, 1);
            bindTexture(compositeProgram, 'u_text', textTexture, 2);
            gl.uniform2f(gl.getUniformLocation(compositeProgram, 'u_resolution'), canvasWebGL.width, canvasWebGL.height);
            gl.uniform1f(gl.getUniformLocation(compositeProgram, 'uDistort'), 0.40); // distortion: 0.40
            gl.uniform1f(gl.getUniformLocation(compositeProgram, 'uReveal'), revealProgress);
            gl.uniform1f(gl.getUniformLocation(compositeProgram, 'u_video_aspect'), videoAspect);
            blit(null); // Draw to screen!

            // Disable CSS cursor styling since WebGL handles the visual render
            cursor.style.boxShadow = 'none';
            cursor.style.border = 'none';
            cursor.style.backgroundColor = 'transparent';
            cursor.style.backdropFilter = 'none';
            cursor.style.webkitBackdropFilter = 'none';
            cursor.style.borderRadius = '0%';
        } else if (!webglActive) {
            // CSS Fallback Mode cursor styling
            cursor.style.borderRadius = ((1 - revealProgress) * 50) + '%';
        }

        // Apply to cursor (box-shadow handles the darkness outside in fallback, or stays transparent in WebGL)
        cursor.style.width = holeW + 'px';
        cursor.style.height = holeH + 'px';
        cursor.style.transform = `translate3d(${holeX - holeW / 2}px, ${holeY - holeH / 2}px, 0)`;

        // ─── Cursor Visibility and Browser Cursor Toggle ──────────
        const shouldHideCursor = (window.scrollY > 300) || (revealState === 'open') || (revealState === 'opening');
        if (cursor) {
            if (shouldHideCursor) {
                cursor.style.display = 'none';
                document.body.style.cursor = 'auto';
                document.querySelectorAll('a, button, .timeline__item, .hero__coords-btn').forEach(el => el.style.cursor = 'pointer');
            } else {
                cursor.style.display = 'flex';
                document.body.style.cursor = 'none';
                document.querySelectorAll('a, button, .timeline__item, .hero__coords-btn').forEach(el => el.style.cursor = 'none');
            }
        }

        // ─── Scroll Container Interaction ──────────────────────────
        const scrollContainer = document.getElementById('scroll-container');
        if (scrollContainer) {
            scrollContainer.style.pointerEvents = 'auto'; // Always interactive to allow scrolling at all times
        }

        // Cursor Prompt Logic removed as requested

        // ─── Render Particles (La Part des Anges) ───────────────────
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;

                // Wrap around
                if (p.y < 0) {
                    p.y = canvas.height;
                    p.x = Math.random() * canvas.width;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(197, 164, 126, ${p.alpha})`; // gold color
                ctx.fill();
            });
        }
        // ─── Render Film Grain (Canvas noise) ────────────────────────
        grainFrame++;
        if (grainFrame % 2 === 0 && grainCtx && grainImageData && grainEnabled) {
            const data = grainImageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const v = (Math.random() * 255) | 0;
                data[i] = v; data[i + 1] = v; data[i + 2] = v;
                data[i + 3] = 4; // Noise intensity
            }
            grainCtx.putImageData(grainImageData, 0, 0);
        }

        requestAnimationFrame(render);
    }

    // ─── Film Grain (Always Active) ────────────────────────────────
    const filmGrain = document.querySelector('.film-grain');
    let grainEnabled = true; // ON by default
    if (filmGrain) {
        filmGrain.style.opacity = '1'; // Ensure it's visible at start
    }

    // ─── Collections Intersection Observer ────────────────────────
    const collectionsSection = document.querySelector('.collections');
    if (collectionsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    collectionsSection.classList.add('is-visible');
                }
            });
        }, { threshold: 0.15 });
        observer.observe(collectionsSection);
    }

    // ─── Collection Cards Mouse Parallax ──────────────────────────
    const cards = document.querySelectorAll('.collection-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;

            const img = card.querySelector('.collection-card__image');
            if (img && typeof gsap !== 'undefined') {
                gsap.to(img, {
                    x: x * 20,
                    y: y * 20,
                    duration: 0.6,
                    ease: "power2.out"
                });
            }
        });

        card.addEventListener('mouseleave', () => {
            const img = card.querySelector('.collection-card__image');
            if (img && typeof gsap !== 'undefined') {
                gsap.to(img, { x: 0, y: 0, duration: 1, ease: "power2.out" });
            }
        });
    });

    // ─── Scroll Effects ───────────────────────────────────────────
    const heroContent = document.querySelector('.hero__content');
    const heroFooter = document.querySelector('.hero__footer');
    const particlesEl = document.getElementById('particles-canvas');
    const timelineEl = document.querySelector('.vertical-timeline');
    const grainEl = document.getElementById('grain-canvas');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const hideThreshold = 300; // Point where hero elements start fading

        // Fade hero content
        if (heroContent) {
            const opacity = Math.max(0, 1 - (scrollY / 400));
            heroContent.style.opacity = opacity;
            heroContent.style.transform = `translateY(${scrollY * 0.15}px)`;
        }

        // Fade hero footer elements (coords & socials)
        if (heroFooter) {
            const opacity = Math.max(0, 1 - (scrollY / 200));
            heroFooter.style.opacity = opacity;
        }

        // Hide/Show hero specific elements
        const shouldHide = scrollY > hideThreshold;

        if (particlesEl) particlesEl.classList.toggle('is-hidden', shouldHide);
        if (timelineEl) timelineEl.classList.toggle('is-hidden', shouldHide);

        // Hide grain overlay when scrolling past hero, keep active on hero
        if (grainEl) {
            grainEl.style.opacity = shouldHide ? '0' : '1';
        }

        // Show header background gradient on scroll
        const header = document.querySelector('.header');
        if (header) {
            header.classList.toggle('has-bg', scrollY > 50 || revealState === 'open');
        }
    });

    // ─── GSAP ScrollTrigger: Heritage Gallery (Vertical Reveal) ────
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        const heritageSection = document.querySelector('.heritage-gallery');
        const slides = gsap.utils.toArray('.gallery__slide');
        const curtainTop = document.querySelector('.curtain__panel--top');
        const curtainBottom = document.querySelector('.curtain__panel--bottom');

        if (heritageSection && slides.length > 0) {
            // Initial state: hide all slides
            gsap.set(slides, { autoAlpha: 0 });
            gsap.set(slides[0], { autoAlpha: 1 });

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: heritageSection,
                    pin: true,
                    scrub: 1.5, // Smoother scrub with more inertia
                    snap: {
                        snapTo: 1 / (slides.length + 3), // Better snap calculation for the curtain stages
                        duration: 0.8,
                        delay: 0.1,
                        ease: "power2.inOut"
                    },
                    start: "top top",
                    end: "+=500%", // Extra space for smoother transitions
                }
            });

            // 1. Initial Reveal
            tl.to(curtainTop, { yPercent: -100, duration: 1.2, ease: "power2.inOut" })
                .to(curtainBottom, { yPercent: 100, duration: 1.2, ease: "power2.inOut" }, "<");

            // 2. Sequential Reveals
            slides.forEach((slide, i) => {
                if (i === 0) return;

                // Close curtain (Mussel shell closing) - Slower and smoother
                tl.to(curtainTop, { yPercent: 0, duration: 1.5, ease: "power2.inOut" })
                    .to(curtainBottom, { yPercent: 0, duration: 1.5, ease: "power2.inOut" }, "<")

                    // Switch slide
                    .set(slides[i - 1], { autoAlpha: 0 })
                    .set(slides[i], { autoAlpha: 1 })

                    // Open curtain (Mussel shell opening) - Slower and smoother
                    .to(curtainTop, { yPercent: -100, duration: 1.5, ease: "power2.inOut" })
                    .to(curtainBottom, { yPercent: 100, duration: 1.5, ease: "power2.inOut" }, "<");

                // Last slide cleanup
                if (i === slides.length - 1) {
                    tl.to([curtainTop, curtainBottom], { borderColor: "transparent", duration: 0.8 }, "-=0.5");
                }
            });

            tl.to({}, { duration: 1 });
        }
    }

    // ─── Menu Overlay Toggle ──────────────────────────────────────
    const menuBtn = document.getElementById('menu-btn');
    const menuOverlay = document.getElementById('menu-overlay');
    const submenuTrigger = document.querySelector('.menu-overlay__link--trigger');
    const submenu = document.querySelector('.menu-overlay__submenu');

    let isMenuOpen = false;

    if (menuBtn && menuOverlay) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });

        // Close menu on overlay background click
        menuOverlay.addEventListener('click', (e) => {
            if (e.target === menuOverlay || e.target.classList.contains('menu-overlay__veil')) {
                closeMenu();
            }
        });

        // Close menu when clicking links (except submenu triggers)
        const menuLinks = menuOverlay.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                closeMenu();
            });
        });
    }

    if (submenuTrigger && submenu) {
        submenuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = submenu.classList.contains('menu-overlay__submenu--open');
            if (isOpen) {
                submenu.classList.remove('menu-overlay__submenu--open');
                submenuTrigger.setAttribute('aria-expanded', 'false');
            } else {
                submenu.classList.add('menu-overlay__submenu--open');
                submenuTrigger.setAttribute('aria-expanded', 'true');
            }
        });
    }

    function toggleMenu() {
        if (isMenuOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    function openMenu() {
        isMenuOpen = true;
        menuBtn.classList.add('header__menu-btn--open');
        menuOverlay.classList.add('menu-overlay--open');

        // Lock body scroll if site is already revealed
        if (document.body.classList.contains('is-revealed')) {
            document.body.style.overflow = 'hidden';
        }

        if (typeof gsap !== 'undefined') {
            // Animate veil overlay
            gsap.fromTo('.menu-overlay__veil',
                { opacity: 0 },
                { opacity: 1, duration: 0.5, ease: "power2.out" }
            );

            // Stagger nav links
            gsap.fromTo('.menu-overlay__item',
                { y: 30, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out", delay: 0.1 }
            );

            // Animate seal and details on the right
            gsap.fromTo('.menu-overlay__right',
                { opacity: 0, scale: 0.95 },
                { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out", delay: 0.3 }
            );
        }
    }

    function closeMenu() {
        isMenuOpen = false;
        menuBtn.classList.remove('header__menu-btn--open');

        // Restore body scroll if site is revealed
        if (document.body.classList.contains('is-revealed')) {
            document.body.style.overflow = '';
        }

        if (typeof gsap !== 'undefined') {
            gsap.to('.menu-overlay__veil', {
                opacity: 0,
                duration: 0.5,
                ease: "power2.inOut",
                onComplete: () => {
                    menuOverlay.classList.remove('menu-overlay--open');
                }
            });

            gsap.to('.menu-overlay__item', {
                y: -20,
                opacity: 0,
                duration: 0.4,
                stagger: 0.05,
                ease: "power2.in"
            });

            gsap.to('.menu-overlay__right', {
                opacity: 0,
                scale: 0.95,
                duration: 0.4,
                ease: "power2.in"
            });
        } else {
            menuOverlay.classList.remove('menu-overlay--open');
        }

        // Close submenu on exit
        if (submenu && submenu.classList.contains('menu-overlay__submenu--open')) {
            submenu.classList.remove('menu-overlay__submenu--open');
            submenuTrigger.setAttribute('aria-expanded', 'false');
        }
    }

    // ─── Map Overlay Toggle & Interaction (3D MapLibre integration) ───
    const coordsBtn = document.getElementById('coords-btn');
    const mapOverlay = document.getElementById('map-overlay');
    const mapCloseBtn = document.getElementById('map-close-btn');
    const mapPrevBtn = document.getElementById('map-prev-btn');
    const mapNextBtn = document.getElementById('map-next-btn');

    const hotspotData = [
        {
            name: "Les Vignobles",
            coords: [-0.078500, 45.614500],
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><path d="M12 2v4M12 6c1.5-1.5 3-1 4-2" /><circle cx="12" cy="8" r="2.5" fill="currentColor" fill-opacity="0.2"/><circle cx="9" cy="11.5" r="2.5" fill="currentColor" fill-opacity="0.2"/><circle cx="15" cy="11.5" r="2.5" fill="currentColor" fill-opacity="0.2"/><circle cx="12" cy="15" r="2.5" fill="currentColor" fill-opacity="0.2"/><circle cx="9.5" cy="18.5" r="2" fill="currentColor" fill-opacity="0.2"/><circle cx="14.5" cy="18.5" r="2" fill="currentColor" fill-opacity="0.2"/><circle cx="12" cy="21.5" r="1.5" fill="currentColor" fill-opacity="0.2"/></svg>`,
            desc: "85 hectares de vignes plantées en Charente. Nos cépages Ugni Blanc et Colombard s'épanouissent sur un terroir calcaire unique.",
            meta: "CÉPAGES: UGNI BLANC, COLOMBARD",
        },
        {
            name: "La Distillerie",
            coords: [-0.079790, 45.611575],
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><path d="M12 2C12 2 6 8 6 13C6 16.3137 8.68629 19 12 19C15.3137 19 18 16.3137 18 13C18 8 12 2 12 2Z" fill="currentColor" fill-opacity="0.2"/><path d="M12 6C12 6 9 10 9 13C9 14.6569 10.3431 16 12 16C13.6569 16 15 14.6569 15 13C15 10 12 6 12 6Z" /><path d="M4 22H20" /></svg>`,
            desc: "La distillation s'effectue en alambic charentais traditionnel, chauffé à feu nu, en double distillation : une première chauffe extrait le brouillis, une seconde donne l'eau-de-vie.",
            meta: "ALAMBIC CHARENTAIS",
        },
        {
            name: "Le Logis Familial",
            coords: [-0.077561, 45.611856],
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><path d="M3 21h18" /><path d="M5 21V10l7-5 7 5v11" fill="currentColor" fill-opacity="0.2"/><path d="M9 21v-4h6v4" /><path d="M12 5v-2" /><rect x="7" y="12" width="2" height="3" /><rect x="15" y="12" width="2" height="3" /></svg>`,
            desc: "La demeure fortifiée de la famille Lhéraud. Ce domaine du Xe et XVIIIe siècle témoigne de l'ancrage profond de la famille sur ce terroir d'exception.",
            meta: "FONDATION: DEPUIS 1680",
        },
        {
            name: "Le Paradis",
            coords: [-0.077267, 45.611945],
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><circle cx="7" cy="12" r="3" fill="currentColor" fill-opacity="0.2" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="17" y1="12" x2="17" y2="15" /><line x1="20" y1="12" x2="20" y2="15" /></svg>`,
            desc: "Le cœur sacré du domaine. Ce chai d'exception abrite nos cognacs les plus précieux et anciens de la maison, certains datant du XIXe siècle, vieillis lentement dans l'obscurité.",
            meta: "RARETÉS : DEPUIS LE XIXeme SIÈCLE",
        },
        {
            name: "Le Chai Historique",
            coords: [-0.075628, 45.613432],
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><ellipse cx="12" cy="7" rx="6" ry="3" fill="currentColor" fill-opacity="0.2" /><path d="M6 7v10c0 1.66 2.69 3 6 3s6-1.34 6-3V7" /><path d="M6 12c0 1.66 2.69 3 6 3s6-1.34 6-3" /><path d="M9 7.5v9.5M15 7.5v9.5" /></svg>`,
            desc: "Notre chai de vieillissement traditionnel. Les fûts de chêne y reposent pour permettre à nos eaux-de-vie de développer lentement leurs arômes.",
            meta: "VIEILLISSEMENT : FÛTS DE CHÊNE",
        }
    ];

    let currentHotspotIndex = 0;
    let isMapOpen = false;
    let mapInstance = null;
    let mapMarkers = [];

    if (coordsBtn && mapOverlay) {
        coordsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openMap();
        });
    }

    if (mapCloseBtn) {
        mapCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMap();
        });
    }

    // Carousel buttons bindings
    if (mapPrevBtn) {
        mapPrevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const prevIdx = (currentHotspotIndex - 1 + hotspotData.length) % hotspotData.length;
            setActiveHotspot(prevIdx);
        });
    }

    if (mapNextBtn) {
        mapNextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const nextIdx = (currentHotspotIndex + 1) % hotspotData.length;
            setActiveHotspot(nextIdx);
        });
    }

    function openMap() {
        if (isMapOpen) return;
        isMapOpen = true;

        mapOverlay.classList.add('map-overlay--open');
        document.body.style.overflow = 'hidden';

        if (typeof gsap !== 'undefined') {
            // Fade in map overlay veil and canvas
            gsap.fromTo(mapOverlay,
                { opacity: 0 },
                { opacity: 1, duration: 0.8, ease: "power2.out" }
            );

            // Animate headers and footers sliding in
            gsap.fromTo('.map-overlay__header',
                { y: -35, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
            );

            gsap.fromTo('.map-overlay__footer',
                { y: 35, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
            );

            // Fade in compass
            gsap.fromTo('.map-overlay__compass',
                { scale: 0.8, opacity: 0 },
                { scale: 0.6, opacity: 0.6, duration: 1, ease: "power2.out", delay: 0.5 }
            );
        }

        // Initialize 3D Map if not created
        if (!mapInstance && typeof maplibregl !== 'undefined') {
            // Bounding box bounds enclosing the estate compound
            const bounds = [
                [-0.098000, 45.602000], // Southwest coordinates [lng, lat]
                [-0.052000, 45.626000]  // Northeast coordinates [lng, lat]
            ];

            mapInstance = new maplibregl.Map({
                container: 'map-3d-canvas',
                zoom: 14.5,
                minZoom: 13.5,
                maxZoom: 17.5, // Stop zoom before tile stretching and "no data" messages appear
                maxBounds: bounds, // Restrict panning area
                center: [-0.075329, 45.613047],
                pitch: 65,
                bearing: 0,
                style: {
                    version: 8,
                    sources: {
                        'esri-satellite': {
                            type: 'raster',
                            tiles: [
                                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                            ],
                            tileSize: 256,
                            attribution: 'Tiles &copy; Esri &mdash; Satellite Imagery'
                        },
                        'aws-terrain': {
                            type: 'raster-dem',
                            tiles: [
                                'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
                            ],
                            encoding: 'terrarium',
                            tileSize: 256,
                            maxzoom: 15
                        }
                    },
                    layers: [
                        {
                            id: 'satellite',
                            type: 'raster',
                            source: 'esri-satellite',
                            paint: {
                                'raster-opacity': 0.35, // 35% opacity to blend with the dark bleu marine background
                                'raster-brightness-max': 0.5, // Darken imagery
                                'raster-saturation': -0.6, // Subtly desaturate greens
                                'raster-contrast': 0.15
                            }
                        }
                    ]
                }
            });

            // Handle map loads (CORS, elevation rendering)
            mapInstance.on('load', () => {

                // Create hotspots markers dynamically
                hotspotData.forEach((item, idx) => {
                    const el = document.createElement('div');
                    el.className = 'map-hotspot';
                    el.style.opacity = '0';
                    el.style.transform = 'scale(0)';

                    el.innerHTML = `
                        <button class="map-hotspot__btn" aria-label="${item.name}">
                            <span class="map-hotspot__icon">${item.icon}</span>
                            <span class="map-hotspot__pulse"></span>
                        </button>
                        <div class="map-hotspot__popover">
                            <h4 class="map-hotspot__title">${item.name}</h4>
                            <p class="map-hotspot__desc">${item.desc}</p>
                            <div class="map-hotspot__meta">${item.meta}</div>
                        </div>
                    `;

                    // Hotspot click listener
                    const btn = el.querySelector('.map-hotspot__btn');
                    if (btn) {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            setActiveHotspot(idx);
                        });
                    }

                    // Add to map
                    const marker = new maplibregl.Marker({
                        element: el,
                        anchor: 'center'
                    })
                        .setLngLat(item.coords)
                        .addTo(mapInstance);

                    mapMarkers.push(marker);
                });

                // Stagger fade/scale in markers
                gsap.fromTo('.map-hotspot',
                    { scale: 0, opacity: 0 },
                    { scale: 1, opacity: 1, duration: 0.6, stagger: 0.15, ease: "back.out(1.5)", delay: 0.3 }
                );

                // Set initial active hotspot
                setActiveHotspot(0);
            });

            // Bind compass rotation to camera bearing rotation
            mapInstance.on('rotate', () => {
                const bearing = mapInstance.getBearing();
                const compassSvg = document.querySelector('.map-overlay__compass-svg');
                if (compassSvg && typeof gsap !== 'undefined') {
                    gsap.to(compassSvg, { rotation: -bearing, duration: 0.2, ease: "power1.out" });
                }
            });
        } else if (mapInstance) {
            // Recalculate canvas size if map was already loaded
            setTimeout(() => {
                mapInstance.resize();
                // Fly back to initial hotspot
                setActiveHotspot(0);

                // Animate markers
                gsap.fromTo('.map-hotspot',
                    { scale: 0, opacity: 0 },
                    { scale: 1, opacity: 1, duration: 0.6, stagger: 0.15, ease: "back.out(1.5)" }
                );
            }, 100);
        }
    }

    function closeMap() {
        if (!isMapOpen) return;
        isMapOpen = false;

        document.body.style.overflow = '';

        if (typeof gsap !== 'undefined') {
            gsap.to(mapOverlay, {
                opacity: 0,
                duration: 0.6,
                onComplete: () => {
                    mapOverlay.classList.remove('map-overlay--open');
                    // Hide active popovers
                    mapMarkers.forEach(m => m.getElement().classList.remove('is-active'));
                }
            });

            gsap.to(['.map-overlay__header', '.map-overlay__footer'], {
                y: (i) => i === 0 ? -25 : 25,
                opacity: 0,
                duration: 0.5,
                ease: "power2.in"
            });
        } else {
            mapOverlay.classList.remove('map-overlay--open');
        }
    }

    function setActiveHotspot(index) {
        currentHotspotIndex = index;

        // Sync styles and popovers for dynamic markers
        mapMarkers.forEach((marker, idx) => {
            const el = marker.getElement();
            if (idx === index) {
                el.classList.add('is-active');
                el.style.zIndex = 999;
            } else {
                el.classList.remove('is-active');
                el.style.zIndex = 1;
            }
        });

        // Update footer texts
        const countEl = document.getElementById('map-current-num');
        const titleEl = document.getElementById('map-current-title');
        const coordsEl = document.getElementById('map-stat-coords');

        if (countEl) countEl.textContent = index + 1;

        if (titleEl) {
            titleEl.textContent = hotspotData[index].name;
        }

        if (coordsEl) {
            const lat = hotspotData[index].coords[1].toFixed(6);
            const lng = hotspotData[index].coords[0].toFixed(6);
            coordsEl.textContent = `${lat}, ${lng}`;
        }

        if (typeof gsap !== 'undefined') {
            // Smooth micro-anim for changing values
            gsap.fromTo([titleEl, coordsEl],
                { opacity: 0, y: 5 },
                { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power2.out" }
            );
        }

        // Fly 3D map camera to position with a stable bearing of -15 degrees.
        // This ensures the North-to-South flight (Vignobles to Distillerie) translates directly downward on the viewport.
        if (mapInstance) {
            mapInstance.flyTo({
                center: hotspotData[index].coords,
                zoom: 16.2,
                pitch: 64,
                bearing: -15,
                duration: 2000,
                essential: true
            });
        }
    }

    // ─── Interactive Compass Drag Rotation ──────────────────────────
    const compassEl = document.querySelector('.map-overlay__compass');
    if (compassEl) {
        let isDraggingCompass = false;

        const rotateMapToCompass = (clientX, clientY) => {
            if (!mapInstance) return;
            const rect = compassEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const angleRad = Math.atan2(clientY - centerY, clientX - centerX);
            const angleDeg = angleRad * 180 / Math.PI + 90;
            mapInstance.setBearing(angleDeg);
        };

        compassEl.addEventListener('mousedown', (e) => {
            isDraggingCompass = true;
            rotateMapToCompass(e.clientX, e.clientY);
        });

        compassEl.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                isDraggingCompass = true;
                rotateMapToCompass(e.touches[0].clientX, e.touches[0].clientY);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isDraggingCompass) {
                rotateMapToCompass(e.clientX, e.clientY);
            }
        });

        window.addEventListener('touchmove', (e) => {
            if (isDraggingCompass && e.touches.length > 0) {
                rotateMapToCompass(e.touches[0].clientX, e.touches[0].clientY);
            }
        });

        window.addEventListener('mouseup', () => {
            isDraggingCompass = false;
        });

        window.addEventListener('touchend', () => {
            isDraggingCompass = false;
        });
    }

    render();
});