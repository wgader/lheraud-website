### CODE HTML
<!DOCTYPE html>
<html lang="fr">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lhéraud - 1680</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>

<body>
    <!-- Ornamental Frame (Cadre de peinture) -->
    <div class="site-frame">
        <div class="site-frame__line site-frame__line--t"></div>
        <div class="site-frame__line site-frame__line--b"></div>
        <div class="site-frame__line site-frame__line--l"></div>
        <div class="site-frame__line site-frame__line--r"></div>
        <div class="site-frame__corner site-frame__corner--tl"></div>
        <div class="site-frame__corner site-frame__corner--tr"></div>
        <div class="site-frame__corner site-frame__corner--bl"></div>
        <div class="site-frame__corner site-frame__corner--br"></div>
    </div>

    <!-- Custom cursor viewfinder -->
    <div class="cursor" id="cursor">
        <div class="cursor__prompt">
            <!-- Vintage Manicule (Pointing Hand) -->
            <svg class="cursor__hand" viewBox="0 0 100 100" fill="none" stroke="var(--color-gold)" stroke-width="0.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path
                    d="M75,50 C75,45 70,42 65,42 C60,42 58,45 58,45 M58,45 C58,40 53,37 48,37 C43,37 41,40 41,40 M41,40 C41,35 36,32 31,32 C26,32 24,35 24,35 M24,35 L24,65 C24,75 32,83 42,83 L60,83 C70,83 75,75 75,65 L75,50 M24,45 L15,45 C10,45 8,42 8,38 L8,25 C8,21 11,18 15,18 L25,18 C30,18 35,22 40,30 L45,40" />
                <path d="M24,35 C24,35 20,32 18,35 C16,38 18,45 24,45" />
            </svg>
            <span class="cursor__text">Maintenez pour découvrir</span>
        </div>
        <div class="cursor__corner cursor__corner--tl"></div>
        <div class="cursor__corner cursor__corner--tr"></div>
        <div class="cursor__corner cursor__corner--bl"></div>
        <div class="cursor__corner cursor__corner--br"></div>
    </div>

    <!-- Background Particles -->
    <canvas id="particles-canvas" class="hero__particles"></canvas>

    <!-- Film Grain Canvas -->
    <canvas id="grain-canvas" class="film-grain"></canvas>

    <!-- Single video -->
    <video src="assets/video/LHERAUD_HEADER SITE_VFFF.mp4" autoplay loop muted playsinline class="video-bg"></video>

    <!-- Navbar -->
    <header class="header">
        <nav class="nav">
            <ul class="nav__list">
                <li class="nav__item">
                    <a href="#" class="nav__link">
                        <span class="nav__text">COGNAC</span>
                        <div class="nav__ink-wrapper">
                            <svg class="nav__ink-svg" viewBox="0 0 100 20" preserveAspectRatio="none">
                                <path d="M 0,10 C 30,15 70,12 100,8" stroke="var(--color-gold)" stroke-width="1.5"
                                    fill="none" stroke-linecap="round" />
                                <path d="M 5,12 C 35,17 75,14 95,9" stroke="var(--color-gold)" stroke-width="0.75"
                                    fill="none" stroke-linecap="round" opacity="0.6" />
                                <path d="M 15,14 C 40,18 60,15 85,10" stroke="var(--color-gold)" stroke-width="0.5"
                                    fill="none" stroke-linecap="round" opacity="0.4" />
                            </svg>
                        </div>
                    </a>
                </li>
                <li class="nav__item">
                    <a href="#" class="nav__link">
                        <span class="nav__text">PINEAU DES CHARENTES</span>
                        <div class="nav__ink-wrapper">
                            <svg class="nav__ink-svg" viewBox="0 0 100 20" preserveAspectRatio="none">
                                <path d="M 0,10 C 30,15 70,12 100,8" stroke="var(--color-gold)" stroke-width="1.5"
                                    fill="none" stroke-linecap="round" />
                                <path d="M 5,12 C 35,17 75,14 95,9" stroke="var(--color-gold)" stroke-width="0.75"
                                    fill="none" stroke-linecap="round" opacity="0.6" />
                                <path d="M 15,14 C 40,18 60,15 85,10" stroke="var(--color-gold)" stroke-width="0.5"
                                    fill="none" stroke-linecap="round" opacity="0.4" />
                            </svg>
                        </div>
                    </a>
                </li>
                <li class="nav__item nav__item--logo">
                    <a href="#"><img src="assets/image/lheraud-groupe.png" alt="Lhéraud" class="nav__logo"></a>
                </li>
                <li class="nav__item">
                    <a href="#armagnac" class="nav__link">
                        <span class="nav__text">ARMAGNAC</span>
                        <div class="nav__ink-wrapper">
                            <svg class="nav__ink-svg" viewBox="0 0 100 20" preserveAspectRatio="none">
                                <path d="M 0,10 C 30,15 70,12 100,8" stroke="var(--color-gold)" stroke-width="1.5"
                                    fill="none" stroke-linecap="round" />
                                <path d="M 5,12 C 35,17 75,14 95,9" stroke="var(--color-gold)" stroke-width="0.75"
                                    fill="none" stroke-linecap="round" opacity="0.6" />
                                <path d="M 15,14 C 40,18 60,15 85,10" stroke="var(--color-gold)" stroke-width="0.5"
                                    fill="none" stroke-linecap="round" opacity="0.4" />
                            </svg>
                        </div>
                    </a>
                </li>
                <li class="nav__item">
                    <a href="#" class="nav__link">
                        <span class="nav__text">WHISKY</span>
                        <div class="nav__ink-wrapper">
                            <svg class="nav__ink-svg" viewBox="0 0 100 20" preserveAspectRatio="none">
                                <path d="M 0,10 C 30,15 70,12 100,8" stroke="var(--color-gold)" stroke-width="1.5"
                                    fill="none" stroke-linecap="round" />
                                <path d="M 5,12 C 35,17 75,14 95,9" stroke="var(--color-gold)" stroke-width="0.75"
                                    fill="none" stroke-linecap="round" opacity="0.6" />
                                <path d="M 15,14 C 40,18 60,15 85,10" stroke="var(--color-gold)" stroke-width="0.5"
                                    fill="none" stroke-linecap="round" opacity="0.4" />
                            </svg>
                        </div>
                    </a>
                </li>
            </ul>
        </nav>
    </header>

    <!-- TEMP: Film Grain Toggle -->
    <button id="grain-toggle" style="
        position: fixed;
        bottom: 2rem;
        left: 2rem;
        z-index: 10015;
        background: rgba(197,164,126,0.15);
        border: 1px solid var(--color-gold);
        color: var(--color-gold);
        padding: 8px 16px;
        font-family: var(--font-sans);
        font-size: 0.65rem;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        cursor: pointer;
        backdrop-filter: blur(4px);
        transition: all 0.3s ease, opacity 0.5s ease;
    ">GRAIN : OFF</button>

    <!-- Vertical Timeline -->
    <aside class="vertical-timeline">
        <div class="timeline__line"></div>
        <div class="timeline__item">
            <span class="timeline__label">LE DOMAINE</span>
            <div class="timeline__marker"></div>
        </div>
        <div class="timeline__item">
            <span class="timeline__label">LE CHAI</span>
            <div class="timeline__marker"></div>
        </div>
        <div class="timeline__item">
            <span class="timeline__label">L'HÉRITAGE</span>
            <div class="timeline__marker"></div>
        </div>
    </aside>
    <main id="scroll-container">
        <!-- Hero Section -->
        <section id="hero" class="hero">
            <div class="hero__content">
                <img src="assets/image/LHERAUD_1680_SIGNATURE_1.png" alt="Lhéraud 1680" class="hero__signature">
            </div>
        </section>

        <!-- Collections Section -->
        <section id="collections" class="collections">
            <div class="collections__header">
                <h2 class="collections__title">Les Collections Lhéraud</h2>
                <div class="collections__line"></div>
            </div>

            <div class="collections__grid">
                <!-- Cognac -->
                <div class="collection-card" data-parallax="0.1">
                    <div class="collection-card__image-wrap">
                        <img src="assets/image/collections/COGNAC-LHERAUD.png" alt="Lhéraud Cognac"
                            class="collection-card__image">
                    </div>
                    <div class="collection-card__content">
                        <span class="collection-card__category">Cognac</span>
                        <h3 class="collection-card__name">Lhéraud <br>Cognac</h3>
                        <a href="#" class="collection-card__link">Découvrir la collection</a>
                    </div>
                </div>

                <!-- Pineau -->
                <div class="collection-card" data-parallax="0.15">
                    <div class="collection-card__image-wrap">
                        <img src="assets/image/collections/PineauF1er-lheraud.png" alt="Pineau François 1er"
                            class="collection-card__image">
                    </div>
                    <div class="collection-card__content">
                        <span class="collection-card__category">Pineau des Charentes</span>
                        <h3 class="collection-card__name">Pineau <br>François 1<sup>er</sup></h3>
                        <a href="#" class="collection-card__link">Découvrir la collection</a>
                    </div>
                </div>

                <!-- Armagnac -->
                <div class="collection-card" data-parallax="0.05">
                    <div class="collection-card__image-wrap">
                        <img src="assets/image/collections/armagnac-lheraud.png" alt="Armagnac Gaston Legrand"
                            class="collection-card__image">
                    </div>
                    <div class="collection-card__content">
                        <span class="collection-card__category">Armagnac</span>
                        <h3 class="collection-card__name">Baron <br>Gaston Legrand</h3>
                        <a href="#" class="collection-card__link">Découvrir la collection</a>
                    </div>
                </div>

                <!-- Whisky -->
                <div class="collection-card" data-parallax="0.12">
                    <div class="collection-card__image-wrap">
                        <img src="assets/image/collections/Lasdoux-Whisky.png" alt="Lasdoux Whisky"
                            class="collection-card__image">
                    </div>
                    <div class="collection-card__content">
                        <span class="collection-card__category">Whisky</span>
                        <h3 class="collection-card__name">Lasdoux <br>Whisky</h3>
                        <a href="#" class="collection-card__link">Découvrir la collection</a>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="script.js"></script>
</body>

</html>

### CSS
:root {
    --color-bg: #0f0d15;
    --color-gold: #d4c5a0;
    --font-sans: 'Montserrat', sans-serif;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    background: var(--color-bg);
    color: var(--color-gold);
    font-family: var(--font-sans);
    width: 100%;
    height: 100vh;
    overflow: hidden;
    /* No scroll at start */
    cursor: none;
}

body.is-revealed {
    overflow-y: auto;
    height: auto;
    cursor: auto;
}

html {
    scroll-behavior: smooth;
}

a {
    cursor: none;
}



body.is-revealed a {
    cursor: pointer;
}

/* ==================== CURSOR ==================== */
.cursor {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 10000;
    /* Must be above everything */
    opacity: 0;
    will-change: transform, width, height;
    box-shadow: 0 0 0 100vmax rgba(20, 22, 28, 0.88);
    border-radius: 2px;
    transition: border-radius 0.4s ease;
    display: flex;
    justify-content: center;
    align-items: center;
}

.cursor__corner {
    position: absolute;
    width: 24px;
    height: 24px;
    border-color: var(--color-gold);
    border-style: solid;
    transition: none;
    will-change: transform, opacity;
}

.cursor__corner--tl {
    top: -1px;
    left: -1px;
    border-width: 2px 0 0 2px;
}

.cursor__corner--tr {
    top: -1px;
    right: -1px;
    border-width: 2px 2px 0 0;
}

.cursor__corner--bl {
    bottom: -1px;
    left: -1px;
    border-width: 0 0 2px 2px;
}

.cursor__corner--br {
    bottom: -1px;
    right: -1px;
    border-width: 0 2px 2px 0;
}


/* ==================== VIDEO ==================== */
.video-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    object-fit: cover;
    z-index: 0;
}


/* ==================== OVERLAYS (REMOVED FOR PERFORMANCE) ==================== */
/* L'effet de filtre sombre est maintenant géré par le box-shadow du curseur,
   ce qui est environ 100x plus performant pour le navigateur. */

/* ==================== HEADER ==================== */
.header {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    padding: 3.5rem 0;
    z-index: 10010;
    /* Above cursor overlay (10000) */
}

/* Dark gradient behind navbar for readability on bright video */
.header::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 150%;
    background: linear-gradient(to bottom, rgba(15, 13, 21, 0.7) 0%, rgba(15, 13, 21, 0.3) 60%, transparent 100%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.8s ease;
    z-index: -1;
}

body.is-revealed .header::before {
    opacity: 1;
}

/* ==================== ORNAMENTAL FRAME ==================== */
.site-frame {
    position: fixed;
    top: 15px;
    left: 15px;
    right: 15px;
    bottom: 15px;
    pointer-events: none;
    z-index: 10005;
    /* Above grain (103) and cursor overlay (10000) */
}

.site-frame__line {
    position: absolute;
    background: var(--color-gold);
    opacity: 0.4;
}

.site-frame__line--t {
    top: 0;
    left: 20px;
    right: 20px;
    height: 1px;
}

.site-frame__line--b {
    bottom: 0;
    left: 20px;
    right: 20px;
    height: 1px;
}

.site-frame__line--l {
    left: 0;
    top: 20px;
    bottom: 20px;
    width: 1px;
}

.site-frame__line--r {
    right: 0;
    top: 20px;
    bottom: 20px;
    width: 1px;
}

.site-frame__corner {
    position: absolute;
    width: 20px;
    height: 20px;
    border-color: var(--color-gold);
    border-style: solid;
    border-radius: 50%;
    opacity: 0.4;
}

.site-frame__corner--tl {
    top: 0;
    left: 0;
    border-width: 0 1px 1px 0;
}

.site-frame__corner--tr {
    top: 0;
    right: 0;
    border-width: 0 0 1px 1px;
}

.site-frame__corner--bl {
    bottom: 0;
    left: 0;
    border-width: 1px 1px 0 0;
}

.site-frame__corner--br {
    bottom: 0;
    right: 0;
    border-width: 1px 0 0 1px;
}

.nav__list {
    display: flex;
    justify-content: center;
    align-items: center;
    list-style: none;
    position: relative;
}

.nav__item {
    display: flex;
    align-items: center;
}

.nav__item--logo {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
}

.nav__item:nth-child(1) {
    margin-right: 3rem;
}

.nav__item:nth-child(2) {
    margin-right: 200px;
}

.nav__item:nth-child(4) {
    margin-left: 200px;
}

.nav__item:nth-child(5) {
    margin-left: 3rem;
}

.nav__link {
    position: relative;
    display: inline-block;
    text-decoration: none;
    padding-bottom: 8px;
}

.nav__text {
    position: relative;
    display: inline-block;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: var(--color-gold);
    transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease;
}

.nav__link:hover .nav__text {
    transform: translateY(-2px);
    opacity: 0.85;
}

.nav__ink-wrapper {
    position: absolute;
    bottom: -10px;
    left: 0;
    width: 100%;
    height: 25px;
    clip-path: inset(0 100% 0 0);
    /* perfectly hides the ink stroke */
    transition: clip-path 0.8s cubic-bezier(0.25, 1, 0.5, 1);
    pointer-events: none;
}

.nav__link:hover .nav__ink-wrapper {
    clip-path: inset(0 0% 0 0);
    /* perfectly reveals the ink stroke */
}

.nav__ink-svg {
    width: 100%;
    height: 100%;
    overflow: visible;
}

.nav__logo {
    height: 65px;
}


/* ==================== HERO & SCROLL WRAPPER ==================== */
#scroll-container {
    position: relative;
    z-index: 10001;
    /* Above cursor overlay (10000) so signature is visible */
}

.hero {
    height: 100vh;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 3rem;
    pointer-events: none;
    z-index: 10005;
    /* Signature above overlay */
    position: relative;
}

.hero__signature {
    height: 90px;
    opacity: 0.85;
    transition: opacity 0.8s ease;
}

/* ==================== COLLECTIONS SECTION ==================== */
.collections {
    position: relative;
    padding: 15rem 4rem 10rem;
    background: linear-gradient(to bottom, transparent, var(--color-bg) 15%, var(--color-bg));
    min-height: 120vh;
    opacity: 0;
    pointer-events: none;
    transition: opacity 1.5s ease;
}

body.is-revealed .collections {
    opacity: 1;
    pointer-events: auto;
}

.collections__header {
    text-align: center;
    margin-bottom: 8rem;
    opacity: 0;
    transform: translateY(30px);
    transition: all 1s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.collections.is-visible .collections__header {
    opacity: 1;
    transform: translateY(0);
}

.collections__title {
    font-size: 2.5rem;
    font-weight: 600;
    letter-spacing: 6px;
    text-transform: uppercase;
    margin-bottom: 2rem;
}

.collections__line {
    width: 60px;
    height: 1px;
    background: var(--color-gold);
    margin: 0 auto;
    opacity: 0.5;
}

.collections__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 3rem;
    max-width: 1600px;
    margin: 0 auto;
}

.collection-card {
    position: relative;
    opacity: 0;
    transform: translateY(50px);
    transition: all 1.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.collections.is-visible .collection-card {
    opacity: 1;
    transform: translateY(0);
}

.collections.is-visible .collection-card:nth-child(2) {
    transition-delay: 0.2s;
}

.collections.is-visible .collection-card:nth-child(3) {
    transition-delay: 0.4s;
}

.collections.is-visible .collection-card:nth-child(4) {
    transition-delay: 0.6s;
}

.collection-card__image-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 0.8;
    margin-bottom: 2rem;
    overflow: visible;
    /* Allow drop shadow glow to exceed boundaries */
    background: transparent;
    transition: all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.collection-card__image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    mix-blend-mode: screen;
    filter: brightness(1) contrast(1);
    transition: all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
    border: none !important;
    box-shadow: none !important;
}

.collection-card__content {
    text-align: center;
    transition: transform 0.6s ease;
}

.collection-card:hover .collection-card__image {
    transform: scale(1.08) translateY(-10px);
    /* Removed drop-shadow as requested */
}

.collection-card:hover .collection-card__content {
    transform: translateY(-5px);
}

.collection-card__category {
    font-size: 0.65rem;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(197, 164, 126, 0.6);
    margin-bottom: 1rem;
    display: block;
}

.collection-card__name {
    font-size: 1.3rem;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 1rem;
    line-height: 1.4;
}

.collection-card__link {
    font-size: 0.65rem;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--color-gold);
    text-decoration: none;
    position: relative;
    padding-bottom: 12px;
    transition: all 0.3s ease;
    display: inline-block;
}

.collection-card__link::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: var(--color-gold);
    transform: scaleX(0.2);
    transform-origin: left;
    transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.collection-card:hover .collection-card__link::after {
    transform: scaleX(1);
}

.collection-card:hover .collection-card__image {
    transform: scale(1.1);
}

.collection-card:hover .collection-card__link::after {
    transform: scaleX(1);
}

/* ==================== PARTICLES ==================== */
.hero__particles {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 102;
    pointer-events: none;
    opacity: 0.7;
    transition: opacity 0.8s ease;
}

.hero__particles.is-hidden {
    opacity: 0;
}

/* ==================== CURSOR PROMPT ==================== */
.cursor__prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
}

.cursor__hand {
    width: 48px;
    height: 48px;
    opacity: 0.8;
    filter: drop-shadow(0 0 2px rgba(197, 164, 126, 0.3));
    animation: handInk 3s infinite ease-in-out;
}

.cursor__text {
    font-size: 0.62rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--color-gold);
    text-align: center;
    user-select: none;
    font-weight: 500;
    margin-top: -5px;
}

@keyframes handInk {

    0%,
    100% {
        transform: translateY(0) rotate(-5deg) scale(1);
    }

    25% {
        transform: translateY(2px) rotate(-3deg) scale(1.02);
    }

    50% {
        transform: translateY(5px) rotate(5deg) scale(1);
    }

    75% {
        transform: translateY(2px) rotate(2deg) scale(0.98);
    }
}

/* ==================== TIMELINE ==================== */
.vertical-timeline {
    position: fixed;
    right: 4rem;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10005;
    /* Above overlay */
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6rem;
    transition: opacity 0.6s ease, transform 0.6s ease;
}

.vertical-timeline.is-hidden {
    opacity: 0;
    transform: translateY(-40%) translateX(20px);
    pointer-events: none;
}

.timeline__line {
    position: absolute;
    right: 4px;
    /* Center with 8px marker */
    top: 0;
    width: 1px;
    height: 100%;
    background: rgba(197, 164, 126, 0.2);
    z-index: 0;
}

.timeline__item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    cursor: pointer;
    z-index: 1;
}

.timeline__label {
    font-size: 0.7rem;
    letter-spacing: 2px;
    color: var(--color-gold);
    opacity: 0;
    text-transform: uppercase;
    transform: translateX(10px);
    transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.timeline__marker {
    width: 8px;
    height: 8px;
    background: transparent;
    border: 1px solid var(--color-gold);
    transform: rotate(45deg);
    transition: all 0.5s ease;
}

.timeline__item:hover .timeline__label {
    opacity: 0.8;
    transform: translateX(0);
}

.timeline__item:hover .timeline__marker {
    background: var(--color-gold);
    box-shadow: 0 0 10px rgba(197, 164, 126, 0.6);
}

/* ==================== FILM GRAIN ==================== */
.film-grain {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 103;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s ease;
}

.film-grain.is-hidden {
    opacity: 0 !important;
}

### JAVASCRIPT
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
