document.addEventListener('DOMContentLoaded', () => {
    const cursor = document.getElementById('cursor');
    const corners = document.querySelectorAll('.cursor__corner');

    // ─── Mouse ─────────────────────────────────────────────────────
    let mouseX = -300, mouseY = -300;
    let cx = -300, cy = -300;
    let cw = 280, ch = 160;
    
    // Blob positions for liquid trailing
    let b1X = -300, b1Y = -300;
    let b2X = -300, b2Y = -300;
    let b3X = -300, b3Y = -300;

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
    const cursorPrompt = cursor.querySelector('.cursor__prompt');
    let grainFrame = 0;

    // ─── WebGL Setup for Liquid Reveal ──────────────────────────────
    const canvasWebGL = document.getElementById('webgl-canvas');
    const videoEl = document.getElementById('bg-video');
    let gl = null;
    let webglActive = false;
    let webglProgram = null;
    let webglTexture = null;

    // Uniform locations
    let uVideoLoc, uResLoc, uTimeLoc, uRadiusLoc, uRevealLoc, uRevealCenterLoc, uBlob1Loc, uBlob2Loc, uBlob3Loc, uVideoAspectLoc;

    if (canvasWebGL && videoEl) {
        gl = canvasWebGL.getContext('webgl') || canvasWebGL.getContext('experimental-webgl');
        if (gl) {
            webglActive = true;

            // Set fallback video off-screen/invisible but keep playing
            videoEl.style.position = 'fixed';
            videoEl.style.width = '1px';
            videoEl.style.height = '1px';
            videoEl.style.opacity = '0.01';
            videoEl.style.pointerEvents = 'none';

            // Vertex Shader
            const vsSource = `
                attribute vec2 position;
                varying vec2 v_texCoord;
                void main() {
                    v_texCoord = position * 0.5 + 0.5;
                    v_texCoord.y = 1.0 - v_texCoord.y; // Flip Y for video texture mapping
                    gl_Position = vec4(position, 0.0, 1.0);
                }
            `;

            // Fragment Shader
            const fsSource = `
                precision mediump float;
                varying vec2 v_texCoord;
                uniform sampler2D u_video;
                uniform vec2 u_resolution;
                uniform float u_time;
                uniform float u_radius;
                uniform float u_reveal_progress;
                uniform vec2 u_reveal_center;
                uniform vec2 u_blob1;
                uniform vec2 u_blob2;
                uniform vec2 u_blob3;
                uniform float u_video_aspect;

                void main() {
                    // Normalize screen coordinates
                    vec2 uv = gl_FragCoord.xy / u_resolution;
                    float aspect = u_resolution.x / u_resolution.y;
                    
                    // Adjust coords for aspect ratio to keep metaballs circular
                    vec2 uvAspect = vec2(uv.x * aspect, uv.y);
                    vec2 b1 = vec2(u_blob1.x * aspect, u_blob1.y);
                    vec2 b2 = vec2(u_blob2.x * aspect, u_blob2.y);
                    vec2 b3 = vec2(u_blob3.x * aspect, u_blob3.y);
                    vec2 revCenter = vec2(u_reveal_center.x * aspect, u_reveal_center.y);

                    // Organic space warp (wobble) to simulate fluid turbulence
                    vec2 warp = vec2(
                        sin(uvAspect.y * 10.0 + u_time * 2.0) * 0.012,
                        cos(uvAspect.x * 10.0 - u_time * 1.8) * 0.012
                    ) * (1.0 - u_reveal_progress);
                    
                    vec2 warpedUV = uvAspect + warp;

                    // Calculate distance to each blob
                    float d1 = length(warpedUV - b1);
                    float d2 = length(warpedUV - b2);
                    float d3 = length(warpedUV - b3);

                    // Exponential density kernel for smooth liquid metaball blending
                    float r1 = u_radius;
                    float r2 = u_radius * 0.85;
                    float r3 = u_radius * 0.70;

                    float density = exp(-(d1 * d1) / (r1 * r1));
                    density += exp(-(d2 * d2) / (r2 * r2)) * 0.85;
                    density += exp(-(d3 * d3) / (r3 * r3)) * 0.65;

                    // Add the expanding central reveal blob
                    if (u_reveal_progress > 0.001) {
                        float dRev = length(warpedUV - revCenter);
                        // Radius of reveal blob grows from 0 to 2.5
                        float rRev = mix(0.001, 2.5, u_reveal_progress);
                        float revDensity = exp(-(dRev * dRev) / (rRev * rRev));
                        density += revDensity * 2.0 * u_reveal_progress;
                    }

                    // Threshold the density field to create a crisp yet liquid drop mask
                    // Threshold goes from 0.35 (idle) down to 0.0 (fully open) to ensure full coverage
                    float threshold = mix(0.35, 0.0, u_reveal_progress);
                    float mask = smoothstep(threshold - 0.03, threshold + 0.03, density);

                    // Displacement refraction along the edge of the liquid boundary
                    float edgeGlow = smoothstep(0.05, 0.0, abs(density - threshold));
                    vec2 displace = (uvAspect - b1) * edgeGlow * 0.025 * (1.0 - u_reveal_progress) * sin(u_time * 3.0 + density * 15.0);

                    // Implement object-fit: cover for the video texture
                    float screenAspect = u_resolution.x / u_resolution.y;
                    vec2 texCoord = v_texCoord;
                    if (screenAspect > u_video_aspect) {
                        // Screen is wider than video: crop Y
                        texCoord.y = (texCoord.y - 0.5) * (u_video_aspect / screenAspect) + 0.5;
                    } else {
                        // Screen is taller than video: crop X
                        texCoord.x = (texCoord.x - 0.5) * (screenAspect / u_video_aspect) + 0.5;
                    }

                    // Apply refraction displacement
                    texCoord += displace;
                    texCoord = clamp(texCoord, 0.001, 0.999);

                    vec4 videoColor = texture2D(u_video, texCoord);

                    // Grayscale conversion for dark backdrop layer (default state)
                    float gray = dot(videoColor.rgb, vec3(0.299, 0.587, 0.114));

                    // Luxury deep navy & gold desaturated tint for background (outside mask)
                    vec3 tintColor = vec3(0.12, 0.15, 0.22);
                    vec3 darkGraded = vec3(gray) * tintColor * 2.5;
                    darkGraded += videoColor.rgb * vec3(0.2, 0.16, 0.1) * (1.0 - gray) * 0.5;

                    // Mix graded and original video textures
                    vec3 finalColor = mix(darkGraded, videoColor.rgb, mask);

                    // Gold border ring highlight
                    vec3 goldColor = vec3(0.64, 0.55, 0.43);
                    finalColor += goldColor * edgeGlow * 0.4 * (1.0 - u_reveal_progress);

                    gl_FragColor = vec4(finalColor, 1.0);
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

            const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
            const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);

            webglProgram = gl.createProgram();
            gl.attachShader(webglProgram, vs);
            gl.attachShader(webglProgram, fs);
            gl.linkProgram(webglProgram);

            if (!gl.getProgramParameter(webglProgram, gl.LINK_STATUS)) {
                console.error('Program link error:', gl.getProgramInfoLog(webglProgram));
            }

            // Setup quad vertices
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

            const positionLocation = gl.getAttribLocation(webglProgram, 'position');
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            // Create texture
            webglTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, webglTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            // Get uniform locations
            uVideoLoc = gl.getUniformLocation(webglProgram, 'u_video');
            uResLoc = gl.getUniformLocation(webglProgram, 'u_resolution');
            uTimeLoc = gl.getUniformLocation(webglProgram, 'u_time');
            uRadiusLoc = gl.getUniformLocation(webglProgram, 'u_radius');
            uRevealLoc = gl.getUniformLocation(webglProgram, 'u_reveal_progress');
            uRevealCenterLoc = gl.getUniformLocation(webglProgram, 'u_reveal_center');
            uBlob1Loc = gl.getUniformLocation(webglProgram, 'u_blob1');
            uBlob2Loc = gl.getUniformLocation(webglProgram, 'u_blob2');
            uBlob3Loc = gl.getUniformLocation(webglProgram, 'u_blob3');
            uVideoAspectLoc = gl.getUniformLocation(webglProgram, 'u_video_aspect');

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
        mouseX = e.clientX;
        mouseY = e.clientY;
        idleTime = 0;
        // if (cursorPrompt) cursorPrompt.style.opacity = '0';
        if (cursor.style.opacity !== '1') {
            cursor.style.opacity = '1';
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;

        // EMPÊCHER le retour à l'intro si le site est déjà révélé
        if (document.body.classList.contains('is-revealed')) return;

        if (revealState === 'idle' || revealState === 'closing') {
            revealAnchorX = mouseX;
            revealAnchorY = mouseY;
            revealInitHalfW = cw / 2;
            revealState = 'opening';
            revealProgress = 0;
        } else {
            revealAnchorX = W() / 2;
            revealAnchorY = H() / 2;
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
        const cornersVisible = revealState === 'idle' && !webglActive;
        corners.forEach(c => c.style.opacity = cornersVisible ? '1' : '0');

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

                // AUTOMATICALLY TURN OFF GRAIN ON REVEAL
                if (filmGrain) {
                    grainEnabled = false;
                    filmGrain.style.opacity = '0';
                    if (grainToggle) grainToggle.textContent = 'GRAIN : OFF';
                }
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

        // Update metaball blob positions with organic lagging
        if (mouseX !== -300) {
            if (b1X === -300) {
                b1X = b2X = b3X = mouseX;
                b1Y = b2Y = b3Y = mouseY;
            } else {
                b1X = lerp(b1X, mouseX, 0.12);
                b1Y = lerp(b1Y, mouseY, 0.12);
                
                b2X = lerp(b2X, b1X, 0.08);
                b2Y = lerp(b2Y, b1Y, 0.08);
                
                b3X = lerp(b3X, b2X, 0.06);
                b3Y = lerp(b3Y, b2Y, 0.06);
            }
        }

        // Apply WebGL scene update and draw
        if (webglActive && videoEl.readyState >= 2) {
            // Update texture from playing video
            gl.bindTexture(gl.TEXTURE_2D, webglTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);

            // Video aspect ratio
            let videoAspect = 16.0 / 9.0;
            if (videoEl.videoWidth && videoEl.videoHeight) {
                videoAspect = videoEl.videoWidth / videoEl.videoHeight;
            }

            // Draw fullscreen quad with liquid reveal shader
            gl.useProgram(webglProgram);
            gl.uniform1i(uVideoLoc, 0);
            gl.uniform2f(uResLoc, canvasWebGL.width, canvasWebGL.height);
            gl.uniform1f(uTimeLoc, performance.now() * 0.001);
            gl.uniform1f(uRadiusLoc, 120.0 / h);
            gl.uniform1f(uRevealLoc, revealProgress);
            
            // Pass the glide center and blob coordinates in normalized 0..1 space (Y flipped for WebGL)
            gl.uniform2f(uRevealCenterLoc, holeX / w, (h - holeY) / h);
            gl.uniform2f(uBlob1Loc, b1X / w, (h - b1Y) / h);
            gl.uniform2f(uBlob2Loc, b2X / w, (h - b2Y) / h);
            gl.uniform2f(uBlob3Loc, b3X / w, (h - b3Y) / h);
            gl.uniform1f(uVideoAspectLoc, videoAspect);

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // Disable CSS overlay styles (WebGL renders the visual mask)
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

        // ─── Scroll Container Interaction ──────────────────────────
        const scrollContainer = document.getElementById('scroll-container');
        if (scrollContainer) {
            scrollContainer.style.pointerEvents = (revealState === 'open') ? 'auto' : 'none';
        }

        // ─── Cursor Prompt Logic (Hand + Text) ──────────────────────
        if (cursorPrompt) {
            // Check if mouse is over any interactive element
            const elUnder = document.elementFromPoint(mouseX, mouseY);
            const overInteractive = elUnder && elUnder.closest('a, img, button, .nav__link, .timeline__item, .nav__logo, #grain-toggle');

            if (revealState === 'idle' && !overInteractive) {
                idleTime++;
                if (idleTime > 90) { // ~1.5 second idle
                    cursorPrompt.style.opacity = '1';
                }
            } else {
                idleTime = 0;
                cursorPrompt.style.opacity = '0';
            }
        }

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

    // ─── TEMP: Grain Toggle ────────────────────────────────────────
    const grainToggle = document.getElementById('grain-toggle');
    const filmGrain = document.querySelector('.film-grain');
    let grainEnabled = true; // ON by default

    if (grainToggle && filmGrain) {
        grainToggle.textContent = 'GRAIN : ON';
        filmGrain.style.opacity = '1'; // Ensure it's visible at start

        grainToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            grainEnabled = !grainEnabled;
            filmGrain.style.opacity = grainEnabled ? '1' : '0';
            grainToggle.textContent = grainEnabled ? 'GRAIN : ON' : 'GRAIN : OFF';
        });
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
    const grainBtn = document.getElementById('grain-toggle');

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
        if (grainEl) grainEl.classList.toggle('is-hidden', shouldHide);
        if (grainBtn) {
            grainBtn.style.opacity = shouldHide ? '0' : '1';
            grainBtn.style.pointerEvents = shouldHide ? 'none' : 'auto';
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

    render();
});