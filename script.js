document.addEventListener('DOMContentLoaded', () => {
    const cursor = document.getElementById('cursor');
    const overlayDesat = document.getElementById('overlay-desat');
    const overlayTint = document.getElementById('overlay-tint');
    const links = document.querySelectorAll('a');

    let mouseX = -300;
    let mouseY = -300;
    let cx = -300;
    let cy = -300;
    let cw = 200;
    let ch = 200;
    let isExpanded = false;
    let hoveredLink = null;

    // Track mouse
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (cursor.style.opacity !== '1') {
            cursor.style.opacity = '1';
        }
    });

    // Click to expand (only on the video area, not on nav links)
    document.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        isExpanded = !isExpanded;
        document.body.style.cursor = isExpanded ? 'auto' : 'none';
    });

    // Link hover: cursor snaps to link dimensions
    links.forEach(link => {
        link.addEventListener('mouseenter', () => { hoveredLink = link; });
        link.addEventListener('mouseleave', () => { hoveredLink = null; });
    });

    // Simple fast lerp
    const lerp = (a, b, t) => a + (b - a) * t;

    // Build the clip-path polygon that covers the full screen EXCEPT a rectangle hole
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    function buildClipPath(l, t, r, b) {
        // Outer rect (clockwise) then inner rect (counter-clockwise) => creates a hole
        return `polygon(
            0px 0px, ${W()}px 0px, ${W()}px ${H()}px, 0px ${H()}px, 0px 0px,
            ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px
        )`;
    }

    function render() {
        // --- Determine targets ---
        let tx = mouseX;
        let ty = mouseY;
        let tw = 200;
        let th = 200;

        if (hoveredLink && !isExpanded) {
            const rect = hoveredLink.getBoundingClientRect();
            tx = rect.left + rect.width / 2;
            ty = rect.top + rect.height / 2;
            tw = rect.width + 40;
            th = rect.height + 20;
        }

        if (isExpanded) {
            tx = W() / 2;
            ty = H() / 2;
            tw = W() + 200;
            th = H() + 200;
        }

        // --- Lerp position & size ---
        const posFactor = isExpanded ? 0.06 : 0.6;
        const sizeFactor = isExpanded ? 0.035 : 0.35;

        cx = lerp(cx, tx, posFactor);
        cy = lerp(cy, ty, posFactor);
        cw = lerp(cw, tw, sizeFactor);
        ch = lerp(ch, th, sizeFactor);

        // --- Update cursor div ---
        const cornerOpacity = (isExpanded && cw > W() * 0.8) ? 0 : 1;
        cursor.style.width = cw + 'px';
        cursor.style.height = ch + 'px';
        cursor.style.transform = `translate3d(${cx - cw / 2}px, ${cy - ch / 2}px, 0)`;
        // Hide corners when fully expanded
        if (cornerOpacity === 0 && cursor.dataset.hidden !== '1') {
            cursor.querySelectorAll('.cursor__corner').forEach(c => c.style.opacity = '0');
            cursor.dataset.hidden = '1';
        } else if (cornerOpacity === 1 && cursor.dataset.hidden === '1') {
            cursor.querySelectorAll('.cursor__corner').forEach(c => c.style.opacity = '1');
            cursor.dataset.hidden = '0';
        }

        // --- Update overlay clip-paths (punch the hole) ---
        const left = cx - cw / 2;
        const top = cy - ch / 2;
        const right = cx + cw / 2;
        const bottom = cy + ch / 2;

        const cp = buildClipPath(left, top, right, bottom);
        overlayDesat.style.clipPath = cp;
        overlayTint.style.clipPath = cp;

        requestAnimationFrame(render);
    }

    render();
});
