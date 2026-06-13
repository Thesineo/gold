(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Aurora background orbs ── */
  function injectAurora() {
    if (document.querySelector('.aurora-bg')) return;
    var wrap = document.createElement('div');
    wrap.className = 'aurora-bg';
    wrap.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 3; i++) {
      var orb = document.createElement('div');
      orb.className = 'aurora-orb';
      wrap.appendChild(orb);
    }
    document.body.insertBefore(wrap, document.body.firstChild);
  }

  /* ── Scroll-reveal via IntersectionObserver ── */
  function initReveal() {
    var targets = document.querySelectorAll(
      'section, .diff-item, .svc-card, .ind-card, .price-card, .how-step, ' +
      '.metric-row, .hero-fact, .vis-split, .img-strip, .trust-inner, .cta-inner, ' +
      '.sec-header, .page-hero-left, .content-block, .blog-card'
    );

    targets.forEach(function (el, i) {
      if (!el.hasAttribute('data-reveal')) {
        el.setAttribute('data-reveal', '');
        if (i % 4 === 1) el.setAttribute('data-reveal-delay', '1');
        if (i % 4 === 2) el.setAttribute('data-reveal-delay', '2');
        if (i % 4 === 3) el.setAttribute('data-reveal-delay', '3');
      }
    });

    if (prefersReduced) {
      document.querySelectorAll('[data-reveal]').forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── Nav scroll state ── */
  function initNavScroll() {
    var nav = document.querySelector('nav');
    if (!nav) return;

    function onScroll() {
      if (window.scrollY > 40) {
        nav.classList.add('nav-scrolled');
      } else {
        nav.classList.remove('nav-scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Animated stat counters ── */
  function initCounters() {
    if (prefersReduced) return;

    var statNums = document.querySelectorAll('.stat-num');
    statNums.forEach(function (el) {
      var text = el.textContent.trim();
      var match = text.match(/^([\d.]+)(.*)$/);
      if (!match) return;

      var target = parseFloat(match[1]);
      var suffix = match[2];
      var isFloat = text.indexOf('.') !== -1;
      var duration = 1400;
      var start = null;

      var counterObserver = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        counterObserver.disconnect();

        function step(ts) {
          if (!start) start = ts;
          var progress = Math.min((ts - start) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          var current = target * eased;
          el.textContent = (isFloat ? current.toFixed(2) : Math.round(current)) + suffix;
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }, { threshold: 0.5 });

      counterObserver.observe(el);
    });
  }

  /* ── Smooth anchor scroll offset for fixed nav ── */
  function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: top, behavior: prefersReduced ? 'auto' : 'smooth' });
      });
    });
  }

  /* ── Parallax hero canvas ── */
  function initHeroParallax() {
    var hero = document.querySelector('.hero');
    var canvas = document.getElementById('hero-canvas');
    if (!hero || !canvas || prefersReduced) return;

    window.addEventListener('scroll', function () {
      var rect = hero.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      var offset = rect.top * 0.15;
      canvas.style.transform = 'translateY(' + offset + 'px)';
    }, { passive: true });
  }

  /* ── Magnetic hover on primary buttons ── */
  function initMagneticButtons() {
    if (prefersReduced || window.innerWidth < 768) return;

    document.querySelectorAll('.btn-primary, .nav-cta, .cta-btn-white').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = 'translate(' + (x * 0.12) + 'px, ' + (y * 0.12 - 2) + 'px)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });
  }

  /* ── Update hero canvas colors if present ── */
  function patchHeroCanvas() {
    /* Canvas colors are set inline in index.html — motion.js exposes globals for override */
    window.CONCAVE_COLORS = {
      ACCENT: [124, 58, 237],
      ACCENT2: [6, 182, 212],
      INK: [6, 8, 15]
    };
  }

  function init() {
    injectAurora();
    initReveal();
    initNavScroll();
    initCounters();
    initSmoothAnchors();
    initHeroParallax();
    initMagneticButtons();
    patchHeroCanvas();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
