// Laptop mockup — iframe lives outside preserve-3d so it stays interactive.
// JS positions it by reading the exact 3D-projected corners of the screen placeholder.
const laptopEl      = document.getElementById('laptop');
const laptopScene   = document.getElementById('laptopScene');
const screenEl      = document.getElementById('laptopScreen');
const iframeWrap    = document.getElementById('laptopIframeWrap');
const laptopIframe  = iframeWrap ? iframeWrap.querySelector('iframe') : null;

function positionIframe() {
    if (!laptopEl || !screenEl || !iframeWrap || !laptopIframe) return;

    // Match iframe wrap's position and height to the laptop frame (pre-transform layout values)
    iframeWrap.style.top    = laptopEl.offsetTop    + 'px';
    iframeWrap.style.height = laptopEl.offsetHeight + 'px';

    // Walk offsetParent chain to get screen's position within the frame
    const screenW = screenEl.offsetWidth;
    const screenH = screenEl.offsetHeight;
    let sl = 0, st = 0, node = screenEl;
    while (node && node !== laptopEl) {
        sl   += node.offsetLeft;
        st   += node.offsetTop;
        node  = node.offsetParent;
    }

    // Scale the 1280-wide iframe to fit the screen's layout width
    const scale = screenW / 1280;
    laptopIframe.style.left      = sl + 'px';
    laptopIframe.style.top       = st + 'px';
    laptopIframe.style.transform = `scale(${scale})`;

    // Clip the wrap to show only the screen area (in pre-transform local coordinates)
    const frameW = laptopEl.offsetWidth;
    const frameH = laptopEl.offsetHeight;
    iframeWrap.style.clipPath =
        `inset(${st}px ${frameW - sl - screenW}px ${frameH - st - screenH}px ${sl}px)`;
}

window.addEventListener('resize', positionIframe, { passive: true });
document.fonts.ready.then(() => { positionIframe(); setTimeout(positionIframe, 200); });

// Power toggle
const powerBtn   = document.getElementById('powerBtn');
const powerLabel = document.getElementById('powerLabel');

let laptopHasIframe = true;

if (powerBtn && laptopEl && laptopIframe) {
    powerBtn.addEventListener('click', () => {
        const isOn = laptopEl.classList.toggle('laptop--on');
        powerBtn.classList.toggle('is-on', isOn);
        powerBtn.setAttribute('aria-pressed', String(isOn));

        iframeWrap.style.pointerEvents = isOn ? 'auto' : 'none';

        if (isOn && laptopHasIframe) {
            laptopEl.classList.add('laptop--booting');
            laptopIframe.style.animation = 'screenBoot 0.75s ease forwards';
            setTimeout(() => {
                laptopEl.classList.remove('laptop--booting');
                laptopIframe.style.animation = '';
                laptopIframe.style.opacity   = '1';
            }, 800);
        } else if (!isOn) {
            laptopIframe.style.opacity  = '0';
            laptopIframe.style.animation = '';
        }

        powerLabel.dataset.i18n = isOn ? 'work.power.on' : 'work.power.off';
        const lang = document.documentElement.lang || 'en';
        const t = (typeof translations !== 'undefined' && translations[lang]) || {};
        if (t[powerLabel.dataset.i18n]) powerLabel.textContent = t[powerLabel.dataset.i18n];
    });
}

// Nav scroll state
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 48);
}, { passive: true });

// Hamburger / mobile menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
});
mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
    });
});

// Scroll-triggered fade-up
const observer = new IntersectionObserver(
    entries => entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
        }
    }),
    { threshold: 0.08 }
);
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// Services accordion
document.querySelectorAll('.service-item').forEach(item => {
    const head = item.querySelector('.service-item__head');
    const body = item.querySelector('.service-item__body');

    head.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');

        // close all
        document.querySelectorAll('.service-item.open').forEach(i => {
            i.classList.remove('open');
            i.querySelector('.service-item__head').setAttribute('aria-expanded', 'false');
        });

        if (!isOpen) {
            item.classList.add('open');
            head.setAttribute('aria-expanded', 'true');
            body.removeAttribute('hidden');
        }
    });
});

// Defragmentation — canvas particle system, velocity physics, no fixed boundary
document.fonts.ready.then(() => {
    const PAD   = 260; // canvas overhang so scattered particles have room to fade
    const PSIZE = 2;
    const STEP  = 2;

    document.querySelectorAll('.hero__title em').forEach(em => {
        let particles = [], cvs = null, ctx2d = null, raf = null, phase = 'idle';

        function sample() {
            const rect = em.getBoundingClientRect();
            const fs   = parseFloat(window.getComputedStyle(em).fontSize);
            const ls   = window.getComputedStyle(em).letterSpacing;
            // Canvas is larger than the em so particles have room to drift
            const W = Math.ceil(rect.width)  + PAD * 2;
            const H = Math.ceil(rect.height) + PAD * 2;

            const probe = document.createElement('canvas');
            probe.width = W; probe.height = H;
            const pc = probe.getContext('2d');
            pc.font = `800 ${fs}px "Syne"`;
            if ('letterSpacing' in pc) pc.letterSpacing = ls;
            pc.fillStyle = '#fff';
            pc.textBaseline = 'middle';
            // Text drawn offset by PAD so it sits in the centre of the larger canvas
            pc.fillText(em.textContent, PAD + 4, H / 2);

            const { data } = pc.getImageData(0, 0, W, H);
            particles = [];
            for (let y = 0; y < H; y += STEP) {
                for (let x = 0; x < W; x += STEP) {
                    if (data[(y * W + x) * 4 + 3] > 110) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 1.5 + Math.random() * 7;
                        particles.push({
                            ox: x, oy: y, x, y,
                            // velocity burst — direction fully random, no shared target
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            alpha: 1,
                        });
                    }
                }
            }
        }

        function mount() {
            if (cvs) cvs.remove();
            const rect = em.getBoundingClientRect();
            const W = Math.ceil(rect.width)  + PAD * 2;
            const H = Math.ceil(rect.height) + PAD * 2;
            cvs = document.createElement('canvas');
            cvs.width = W; cvs.height = H;
            // position: absolute anchors to document — scrolls with page, stays locked
            Object.assign(cvs.style, {
                position: 'absolute',
                top:  (rect.top  + window.scrollY - PAD) + 'px',
                left: (rect.left + window.scrollX - PAD) + 'px',
                pointerEvents: 'none',
                zIndex: '1000',
            });
            ctx2d = cvs.getContext('2d');
            document.body.appendChild(cvs);
        }

        function draw() {
            ctx2d.clearRect(0, 0, cvs.width, cvs.height);
            for (const p of particles) {
                if (p.alpha < 0.015) continue;
                ctx2d.globalAlpha = p.alpha;
                ctx2d.fillStyle = '#fff';
                ctx2d.fillRect(p.x | 0, p.y | 0, PSIZE, PSIZE);
            }
            ctx2d.globalAlpha = 1;
        }

        // Scatter: velocity + drag + fast alpha decay — no target, no visible boundary
        function tickScatter() {
            let done = true;
            for (const p of particles) {
                p.x    += p.vx;
                p.y    += p.vy;
                p.vx   *= 0.93;
                p.vy   *= 0.93;
                p.alpha *= 0.86;
                if (p.alpha > 0.015) done = false;
            }
            draw();
            if (!done && phase === 'scatter') raf = requestAnimationFrame(tickScatter);
            // when fully faded, stop; canvas + hidden em stay until mouseleave
        }

        // Assemble: spring toward origin + fade back in
        function tickAssemble() {
            let done = true;
            for (const p of particles) {
                const dx = p.ox - p.x, dy = p.oy - p.y;
                p.vx = (p.vx + dx * 0.2) * 0.75;
                p.vy = (p.vy + dy * 0.2) * 0.75;
                p.x += p.vx; p.y += p.vy;
                p.alpha += (1 - p.alpha) * 0.12;
                if (p.alpha < 0.98 || Math.abs(dx) > 0.4) done = false;
            }
            draw();
            if (!done && phase === 'assemble') {
                raf = requestAnimationFrame(tickAssemble);
            } else if (done) {
                em.style.transition = 'opacity 0.2s ease';
                em.style.opacity = '1';
                setTimeout(() => {
                    em.style.transition = '';
                    cvs.remove(); cvs = null;
                    phase = 'idle';
                }, 220);
            }
        }

        em.addEventListener('mouseenter', () => {
            cancelAnimationFrame(raf);
            em.style.transition = 'none';
            em.style.opacity = '0';

            if (phase === 'idle') {
                sample();
                mount();
            } else {
                // Re-burst from wherever particles currently are
                for (const p of particles) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1.5 + Math.random() * 7;
                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed;
                }
            }
            phase = 'scatter';
            raf = requestAnimationFrame(tickScatter);
        });

        em.addEventListener('mouseleave', () => {
            if (!cvs) return;
            cancelAnimationFrame(raf);
            for (const p of particles) { p.vx = 0; p.vy = 0; }
            phase = 'assemble';
            raf = requestAnimationFrame(tickAssemble);
        });
    });
});

// =====================
// Canvas Grain Noise
// =====================
(function () {
    const wrap = document.querySelector('.grain');
    if (!wrap) return;

    const SIZE = 700;
    const cvs  = document.createElement('canvas');
    cvs.width  = cvs.height = SIZE;
    Object.assign(cvs.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    wrap.appendChild(cvs);

    const ctx = cvs.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    const d   = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = 255; // pre-fill alpha

    function draw() {
        for (let i = 0; i < d.length; i += 4) {
            const v = (Math.random() * 255) | 0;
            d[i] = d[i + 1] = d[i + 2] = v;
        }
        ctx.putImageData(img, 0, 0);
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        draw();
    } else {
        let fr = 0;
        (function tick() { if (++fr % 3 === 0) draw(); requestAnimationFrame(tick); })();
    }
})();

// =====================
// Custom Cursor
// =====================
(function () {
    const dot  = document.querySelector('.cursor');
    const ring = document.querySelector('.cursor-ring');
    if (!dot || !ring) return;

    let mx = -200, my = -200, rx = -200, ry = -200;

    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

    (function tick() {
        dot.style.left  = mx + 'px';
        dot.style.top   = my + 'px';
        rx += (mx - rx) * 0.13;
        ry += (my - ry) * 0.13;
        ring.style.left = rx + 'px';
        ring.style.top  = ry + 'px';
        requestAnimationFrame(tick);
    })();

    document.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('mouseenter', () => { dot.classList.add('is-hover');    ring.classList.add('is-hover');    });
        el.addEventListener('mouseleave', () => { dot.classList.remove('is-hover'); ring.classList.remove('is-hover'); });
    });

    document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; ring.style.opacity = '1'; });
})();

// =====================
// Hero Geo Parallax
// =====================
(function () {
    const hero = document.querySelector('.hero');
    const geo  = document.querySelector('.hero__geo');
    if (!hero || !geo) return;

    hero.addEventListener('mousemove', e => {
        const r = hero.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width  - 0.5) * 28;
        const y = ((e.clientY - r.top)  / r.height - 0.5) * 16;
        geo.style.transform = `translate(${x}px, ${y}px)`;
    }, { passive: true });

    hero.addEventListener('mouseleave', () => { geo.style.transform = ''; });
})();

// =====================
// Price Count-Up
// =====================
(function () {
    const el = document.querySelector('.pricing-card__amount[data-countup]');
    if (!el) return;

    const target = parseInt(el.dataset.countup, 10);
    let triggered = false;

    function fmt(n) {
        return n >= 1000
            ? Math.floor(n / 1000) + ',' + String(n % 1000).padStart(3, '0')
            : String(n);
    }

    new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting || triggered) return;
        triggered = true;
        const dur = 1400;
        let start = null;
        (function animate(ts) {
            if (!start) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            el.textContent = fmt(Math.round(ease * target));
            if (p < 1) requestAnimationFrame(animate);
        })(performance.now());
    }, { threshold: 0.4 }).observe(el);
})();

// =====================
// Stats Bar Reveal
// =====================
(function () {
    const items = document.querySelectorAll('.stats-bar__item');
    if (!items.length) return;
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.2 });
    items.forEach(el => obs.observe(el));
})();

// =====================
// Active Nav Highlight
// =====================
(function () {
    const navLinks = document.querySelectorAll('.nav__links a[href^="#"]');
    if (!navLinks.length) return;
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                navLinks.forEach(a => a.classList.remove('is-active'));
                const active = document.querySelector(`.nav__links a[href="#${e.target.id}"]`);
                if (active) active.classList.add('is-active');
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('section[id]').forEach(s => obs.observe(s));
    const heroEl = document.getElementById('home');
    if (heroEl) obs.observe(heroEl);
})();

// =====================
// Portfolio Carousel
// =====================
(function () {
    const projects = [
        { name: 'Enigma',       typeKey: 'work.enigma.type', src: 'https://franogaming123-code.github.io/Enigma/', hasIframe: true  },
        { name: 'Bloom Bakery', typeKey: 'work.bloom.type',  src: null,                                            hasIframe: false },
        { name: 'Atlas Studio', typeKey: 'work.atlas.type',  src: null,                                            hasIframe: false },
    ];

    const laptop    = document.getElementById('laptop');
    const iframe    = document.querySelector('#laptopIframeWrap iframe');
    const nameEl    = document.querySelector('.work-card__name');
    const typeEl    = document.querySelector('.work-card__type');
    const phName    = document.getElementById('placeholderName');
    const pBtn      = document.getElementById('powerBtn');
    const pLabel    = document.getElementById('powerLabel');
    const prevBtn   = document.getElementById('workPrev');
    const nextBtn   = document.getElementById('workNext');
    const dots      = document.querySelectorAll('.work-nav-dot');

    if (!laptop || !prevBtn) return;

    let current = 0;

    function goTo(idx) {
        const proj = projects[idx];

        if (laptop.classList.contains('laptop--on')) {
            laptop.classList.remove('laptop--on');
            if (iframe) { iframe.style.opacity = '0'; iframe.style.animation = ''; }
            if (pBtn) {
                pBtn.classList.remove('is-on');
                pBtn.setAttribute('aria-pressed', 'false');
                const t = (typeof translations !== 'undefined' && translations[document.documentElement.lang || 'en']) || {};
                if (pLabel) { pLabel.dataset.i18n = 'work.power.off'; pLabel.textContent = t['work.power.off'] || 'Turn on'; }
            }
        }

        if (nameEl) nameEl.textContent = proj.name;
        if (typeEl) {
            typeEl.dataset.i18n = proj.typeKey;
            const t = (typeof translations !== 'undefined' && translations[document.documentElement.lang || 'en']) || {};
            typeEl.textContent = t[proj.typeKey] || proj.name;
        }

        laptopHasIframe = proj.hasIframe;
        if (proj.hasIframe) {
            if (iframe) iframe.src = proj.src;
            laptop.classList.remove('laptop--placeholder');
        } else {
            laptop.classList.add('laptop--placeholder');
            if (phName) phName.textContent = proj.name;
        }

        dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
        current = idx;
    }

    prevBtn.addEventListener('click', () => goTo((current - 1 + projects.length) % projects.length));
    nextBtn.addEventListener('click', () => goTo((current + 1) % projects.length));
    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
})();

// Contact form
const form = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    setTimeout(() => {
        form.reset();
        btn.textContent = orig;
        btn.disabled = false;
        formSuccess.style.display = 'block';
        setTimeout(() => { formSuccess.style.display = 'none'; }, 5000);
    }, 900);
});
