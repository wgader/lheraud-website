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
});
