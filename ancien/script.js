document.addEventListener('DOMContentLoaded', () => {
    const cursor = document.getElementById('cursor');
    const corners = document.querySelectorAll('.cursor__corner');

    // ─── Mouse ─────────────────────────────────────────────────────
    let mouseX = -300, mouseY = -300;
    let cx = -300, cy = -300;
    let cw = 280, ch = 160;

    // ─── Reveal state ──────────────────────────────────────────────
    let revealState = 'idle';
    let revealProgress = 0;
    let revealAnchorX = 0;
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
            revealInitHalfW = cw / 2;
            revealState = 'opening';
            revealProgress = 0;
        } else {
            revealState = 'closing';
        }
    });

    // ─── Render loop ───────────────────────────────────────────────
    function render() {
        const w = W(), h = H();

        let tx = mouseX, ty = mouseY;
        let tw = 280, th = 160;

        cursor.style.borderRadius = '2px';

        // LERP "Ultra Smooth" (Encore plus lent et cinématographique)
        cx = lerp(cx, tx, 0.05);
        cy = lerp(cy, ty, 0.05);
        cw = lerp(cw, tw, 0.05);
        ch = lerp(ch, th, 0.05);

        // Hide corners during reveal
        const cornersVisible = revealState === 'idle';
        corners.forEach(c => c.style.opacity = cornersVisible ? '1' : '0');

        // ── Compute reveal hole ───────────────────────────────────
        let holeW = cw, holeH = ch;
        let holeX = cx, holeY = cy;

        const maxHalfW = Math.max(revealAnchorX, w - revealAnchorX) + 60;

        if (revealState === 'opening') {
            revealProgress = Math.min(1, revealProgress + OPEN_SPEED);
            const e = easeOut(revealProgress);

            holeW = lerp(cw, maxHalfW * 2, e);
            holeX = revealAnchorX; // stays centered on click point

            const eY = Math.min(1, revealProgress * 4);
            holeH = lerp(ch, h * 1.5, eY);
            holeY = cy; // height expands from current mouse Y

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
            holeX = lerp(cx, revealAnchorX, e); // glides back to mouse

            const eY = Math.min(1, revealProgress * 4);
            holeH = lerp(ch, h * 1.5, eY);
            holeY = cy; // shrinks towards mouse Y

            if (revealProgress <= 0) {
                revealState = 'idle';
            }
        }

        // Apply to cursor (box-shadow handles the darkness outside)
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
        if (grainFrame % 4 === 0 && grainCtx && grainImageData) {
            const data = grainImageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const v = (Math.random() * 255) | 0;
                data[i] = v; // R
                data[i + 1] = v; // G
                data[i + 2] = v; // B
                data[i + 3] = 16; // Alpha (~6% visible, subtle grain)
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
    const heroSignature = document.querySelector('.hero__signature');
    const particlesEl = document.getElementById('particles-canvas');
    const timelineEl = document.querySelector('.vertical-timeline');
    const grainEl = document.getElementById('grain-canvas');
    const grainBtn = document.getElementById('grain-toggle');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const hideThreshold = 300; // Point where hero elements start fading

        // Fade hero signature
        if (heroSignature) {
            const opacity = Math.max(0, 0.85 - (scrollY / 400));
            heroSignature.style.opacity = opacity;
            heroSignature.style.transform = `translateY(${scrollY * 0.2}px)`;
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

    render();
});