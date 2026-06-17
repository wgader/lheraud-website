document.addEventListener('DOMContentLoaded', () => {
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

    function closeMenu() {
        isMenuOpen = false;
        menuBtn.classList.remove('header__menu-btn--open');
        document.body.classList.remove('has-menu-open');

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

        // Toggle has-bg class on close
        const header = document.querySelector('.header');
        if (header && window.scrollY <= 50) {
            header.classList.remove('has-bg');
        }
    }

    // Toggle has-bg class on open
    function openMenu() {
        isMenuOpen = true;
        menuBtn.classList.add('header__menu-btn--open');
        menuOverlay.classList.add('menu-overlay--open');
        document.body.classList.add('has-menu-open');

        // Lock body scroll if site is already revealed
        if (document.body.classList.contains('is-revealed')) {
            document.body.style.overflow = 'hidden';
        }

        const header = document.querySelector('.header');
        if (header) {
            header.classList.add('has-bg');
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

    // Scroll listener for header background
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (header) {
            const isRevealed = document.body.classList.contains('is-revealed');
            header.classList.toggle('has-bg', window.scrollY > 50 || isMenuOpen || isRevealed);
        }
    });

    // ─── .btn-frame hover border animation ───────────────────────────
    // Adjustable settings
    const SEG_FRAC = 0.38;   // fraction of half-perimeter for each thick dash at rest

    /**
     * setupBtn — initialise one .btn-frame element.
     * Creates the SVG overlay, computes geometry, wires hover listeners.
     */
    function setupBtn(el) {
        const ns = 'http://www.w3.org/2000/svg';

        /* ── build SVG skeleton ── */
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'btn-frame__svg');
        svg.setAttribute('preserveAspectRatio', 'none');

        // Draw the thin rect as a path to prevent alignment discrepancies between rect and path rendering
        const rectEl = document.createElementNS(ns, 'path');
        rectEl.setAttribute('class', 'btn-frame__rect');

        // Two thick paths: one starts top-center going right, other starts bottom-center going left
        const segA = document.createElementNS(ns, 'path');  // top → right → bottom
        segA.setAttribute('class', 'btn-frame__seg');

        const segB = document.createElementNS(ns, 'path');  // bottom → left → top
        segB.setAttribute('class', 'btn-frame__seg');

        svg.append(rectEl, segA, segB);
        el.appendChild(svg);

        /* ── geometry helpers ── */
        let halfPerim = 0, seg = 0;

        function measure() {
            const rect = el.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;

            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

            // Coordinates centered on the 1px / 3px strokes
            const cx = w / 2;   // center x
            const r  = w - 0.5; // right edge
            const b  = h - 0.5; // bottom edge
            const l  = 0.5;     // left edge
            const t  = 0.5;     // top edge

            // Thin frame path
            const dRect = `M ${l} ${t} L ${r} ${t} L ${r} ${b} L ${l} ${b} Z`;
            rectEl.setAttribute('d', dRect);

            // segA path: top-center → top-right corner → bottom-right corner → bottom-center
            const dA = `M ${cx} ${t} L ${r} ${t} L ${r} ${b} L ${cx} ${b}`;
            // segB path: bottom-center → bottom-left corner → top-left corner → top-center
            const dB = `M ${cx} ${b} L ${l} ${b} L ${l} ${t} L ${cx} ${t}`;

            segA.setAttribute('d', dA);
            segB.setAttribute('d', dB);

            // half perimeter length (safe bounds for offscreen/hidden buttons)
            halfPerim = Math.max(0, w - 1) + Math.max(0, h - 1);
            seg = halfPerim * SEG_FRAC;

            // Apply dasharray: [seg/2 visible] [rest invisible] [seg/2 visible]
            const dashRest = `${seg / 2} ${halfPerim - seg} ${seg / 2}`;
            segA.style.strokeDasharray = dashRest;
            segB.style.strokeDasharray = dashRest;

            // If currently hovered, keep hovered state
            if (el.matches(':hover')) {
                applyHover();
            } else {
                applyRest();
            }
        }

        function applyRest() {
            const dashRest = `${seg / 2} ${halfPerim - seg} ${seg / 2}`;
            segA.style.strokeDasharray = dashRest;
            segB.style.strokeDasharray = dashRest;
        }

        function applyHover() {
            // Entire half-perimeter becomes thick
            const dashHover = `${halfPerim} 0 0`;
            segA.style.strokeDasharray = dashHover;
            segB.style.strokeDasharray = dashHover;
        }

        /* ── events ── */
        el.addEventListener('mouseenter', applyHover);
        el.addEventListener('mouseleave', applyRest);

        /* ── resize observer with subpixel support ── */
        let prevW = 0, prevH = 0;
        const ro = new ResizeObserver(() => {
            const rect = el.getBoundingClientRect();
            const w = rect.width, h = rect.height;
            if (Math.abs(w - prevW) < 0.5 && Math.abs(h - prevH) < 0.5) return;
            prevW = w; prevH = h;
            measure();
        });
        ro.observe(el);

        // initial measure
        measure();
    }

    /* ── init all .btn-frame buttons ── */
    document.querySelectorAll('.btn-frame').forEach(setupBtn);
});
