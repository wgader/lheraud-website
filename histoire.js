document.addEventListener('DOMContentLoaded', () => {
    // ─── Interactive History Timeline ───────────────────────────
    const friseItems = document.querySelectorAll('.frise__item');
    const historyBgYear = document.getElementById('history-bg-year');
    const historyTitle = document.getElementById('history-title');
    const historyDesc = document.getElementById('history-desc');
    const historyImage = document.getElementById('history-image');

    const timelineData = [
        {
            year: "1680",
            label: "NOTRE MAISON",
            title: "HISTOIRE <br><span class=\"family-history__italic\">de famille</span>",
            desc: "Trois générations.<br>Un seul nom<br><span class=\"gold-text\">Depuis 1680</span>",
            image: "assets/image/famille.png"
        },
        {
            year: "XIXe",
            label: "L'HÉRITAGE",
            title: "SAVOIR-FAIRE <br><span class=\"family-history__italic\">d'exception</span>",
            desc: "Un domaine préservé.<br>La tradition du pineau<br><span class=\"gold-text\">François 1er</span>",
            image: "assets/image/famille-2.png"
        },
        {
            year: "2026",
            label: "AUJOURD'HUI",
            title: "TRANSMISSION <br><span class=\"family-history__italic\">et modernité</span>",
            desc: "L'excellence perpétuée.<br>Des spiritueux rares<br><span class=\"gold-text\">À travers le monde</span>",
            image: "assets/image/famille-2.png"
        }
    ];

    // Preload images to prevent lag/flashing during transitions
    if (typeof Image !== 'undefined') {
        timelineData.forEach(data => {
            const img = new Image();
            img.src = data.image;
        });
    }

    if (friseItems.length > 0 && historyBgYear && historyTitle && historyDesc && historyImage) {
        friseItems.forEach(item => {
            item.addEventListener('click', () => {
                // If this item is already active, do nothing
                if (item.classList.contains('active')) return;

                const idx = parseInt(item.getAttribute('data-index'));
                if (isNaN(idx)) return;

                const prevActive = document.querySelector('.frise__item.active');
                const prevIdx = prevActive ? parseInt(prevActive.getAttribute('data-index')) : 0;

                // Remove active class from all items and set current active
                friseItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                const data = timelineData[idx];

                // Smooth luxury transitions using GSAP if available
                if (typeof gsap !== 'undefined') {
                    const direction = idx > prevIdx ? -15 : 15;

                    // 1. Text elements: slide and fade transition
                    gsap.to([historyTitle, historyDesc], {
                        opacity: 0,
                        y: direction,
                        duration: 0.3,
                        stagger: 0.03,
                        ease: "power2.in",
                        onComplete: () => {
                            // Update content
                            historyTitle.innerHTML = data.title;
                            historyDesc.innerHTML = data.desc;

                            const label = document.querySelector('.family-history__label');
                            if (label) label.innerText = data.label;

                            // Reset Y position for slide-in from opposite direction
                            gsap.set([historyTitle, historyDesc], {
                                y: -direction
                            });

                            // Fade and slide in new text content
                            gsap.to([historyTitle, historyDesc], {
                                opacity: 1,
                                y: 0,
                                duration: 0.4,
                                stagger: 0.03,
                                ease: "power2.out"
                            });
                        }
                    });

                    // 2. Large Photo: Pure opacity crossfade with preloaded cache (eliminates layout jumps)
                    gsap.to(historyImage, {
                        opacity: 0,
                        duration: 0.25,
                        ease: "power1.in",
                        onComplete: () => {
                            historyImage.src = data.image;
                            gsap.to(historyImage, {
                                opacity: 1,
                                duration: 0.4,
                                ease: "power2.out"
                            });
                        }
                    });

                    // 3. Background Year: Simple opacity crossfade (no translation/scale to look clean)
                    gsap.to(historyBgYear, {
                        opacity: 0,
                        duration: 0.25,
                        ease: "power1.in",
                        onComplete: () => {
                            historyBgYear.innerText = data.year;
                            gsap.to(historyBgYear, {
                                opacity: 1,
                                duration: 0.4,
                                ease: "power2.out"
                            });
                        }
                    });

                } else {
                    // Fallback static change if GSAP is not available
                    historyBgYear.innerText = data.year;
                    historyTitle.innerHTML = data.title;
                    historyDesc.innerHTML = data.desc;
                    historyImage.src = data.image;
                    const label = document.querySelector('.family-history__label');
                    if (label) label.innerText = data.label;
                }
            });
        });
    }
});
