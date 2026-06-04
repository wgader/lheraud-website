document.addEventListener('DOMContentLoaded', () => {
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
    let mapInstance = null;
    let mapMarkers = [];

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

    function initMap() {
        if (typeof maplibregl === 'undefined') return;

        const bounds = [
            [-0.098000, 45.602000], // Southwest coordinates [lng, lat]
            [-0.052000, 45.626000]  // Northeast coordinates [lng, lat]
        ];

        mapInstance = new maplibregl.Map({
            container: 'map-3d-canvas',
            zoom: 14.5,
            minZoom: 13.5,
            maxZoom: 17.5,
            maxBounds: bounds,
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
                    }
                },
                layers: [
                    {
                        id: 'satellite',
                        type: 'raster',
                        source: 'esri-satellite',
                        paint: {
                            'raster-opacity': 0.35,
                            'raster-brightness-max': 0.5,
                            'raster-saturation': -0.6,
                            'raster-contrast': 0.15
                        }
                    }
                ]
            }
        });

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

                const btn = el.querySelector('.map-hotspot__btn');
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        setActiveHotspot(idx);
                    });
                }

                const marker = new maplibregl.Marker({
                    element: el,
                    anchor: 'center'
                })
                    .setLngLat(item.coords)
                    .addTo(mapInstance);

                mapMarkers.push(marker);
            });

            // Stagger fade/scale in markers
            if (typeof gsap !== 'undefined') {
                gsap.fromTo('.map-hotspot',
                    { scale: 0, opacity: 0 },
                    { scale: 1, opacity: 1, duration: 0.6, stagger: 0.15, ease: "back.out(1.5)", delay: 0.3 }
                );
            }

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

        const countEl = document.getElementById('map-current-num');
        const titleEl = document.getElementById('map-current-title');
        const coordsEl = document.getElementById('map-stat-coords');

        if (countEl) countEl.textContent = index + 1;
        if (titleEl) titleEl.textContent = hotspotData[index].name;

        if (coordsEl) {
            const lat = hotspotData[index].coords[1].toFixed(6);
            const lng = hotspotData[index].coords[0].toFixed(6);
            coordsEl.textContent = `${lat}, ${lng}`;
        }

        if (typeof gsap !== 'undefined' && titleEl && coordsEl) {
            gsap.fromTo([titleEl, coordsEl],
                { opacity: 0, y: 5 },
                { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power2.out" }
            );
        }

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

    // Compass dragging rotation
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

    // Animate map overlay loading animations
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('.map-overlay__header',
            { y: -35, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
        );

        gsap.fromTo('.map-overlay__footer',
            { y: 35, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
        );

        gsap.fromTo('.map-overlay__compass',
            { scale: 0.8, opacity: 0 },
            { scale: 0.6, opacity: 0.6, duration: 1, ease: "power2.out", delay: 0.5 }
        );
    }

    initMap();
});
