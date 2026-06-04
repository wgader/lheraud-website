document.addEventListener('DOMContentLoaded', () => {
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
});