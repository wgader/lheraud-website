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
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (cursor.style.opacity !== '1') {
            cursor.style.opacity = '1';
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;

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

        requestAnimationFrame(render);
    }

    // ─── GSAP Hover Animation for Links ────────────────────────────
    document.querySelectorAll('.nav__link').forEach(link => {
        const svg = link.querySelector('.nav__underline');
        if (!svg) return;
        
        // Un masque très grand verticalement pour ne pas couper les courbes accentuées
        const clipHidden = 'polygon(0% -200%, 0% -200%, 0% 300%, 0% 300%)';
        const clipVisible = 'polygon(0% -200%, 105% -200%, 105% 300%, 0% 300%)';
        
        gsap.set(svg, {
            clipPath: clipHidden,
            WebkitClipPath: clipHidden
        });
        
        link.addEventListener('mouseenter', () => {
            // Calculer la durée d'animation en fonction de la largeur du mot
            // (les mots longs mettront plus de temps pour garder une vitesse d'écriture constante)
            const width = link.offsetWidth;
            const durationIn = 0.4 + (width / 400); // Ex: 100px -> 0.65s, 300px -> 1.15s
            
            gsap.to(svg, {
                clipPath: clipVisible,
                WebkitClipPath: clipVisible,
                duration: durationIn,
                ease: "power2.out",
                overwrite: true
            });
        });
        
        link.addEventListener('mouseleave', () => {
            const width = link.offsetWidth;
            const durationOut = 0.3 + (width / 500); // Légèrement plus rapide pour s'effacer
            
            gsap.to(svg, {
                clipPath: clipHidden,
                WebkitClipPath: clipHidden,
                duration: durationOut,
                ease: "power2.inOut",
                overwrite: true
            });
        });
    });

    render();
});