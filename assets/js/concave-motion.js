(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Scroll-reveal via IntersectionObserver (opt-in via [data-reveal]) ── */
  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    if (prefersReduced) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
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
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );

    targets.forEach(function (el) { observer.observe(el); });
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

  /* ── Mobile nav toggle ── */
  function initMobileMenu() {
    var toggle = document.getElementById('menuToggle');
    var links = document.getElementById('navLinks');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
      links.classList.toggle('active');
    });

    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('active'); });
    });
  }

  /* ── Theme toggle (light/dark, persisted) ── */
  function initThemeToggle() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('concave-theme', next); } catch (e) {}
      document.dispatchEvent(new CustomEvent('concave:themechange'));
    });
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

  /* ── Parallax on any .bg-media canvas inside a full-bleed section ── */
  function initBgParallax() {
    if (prefersReduced) return;
    var layers = document.querySelectorAll('.bg-media');
    if (!layers.length) return;

    window.addEventListener('scroll', function () {
      layers.forEach(function (layer) {
        var section = layer.closest('section');
        if (!section) return;
        var rect = section.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        layer.style.transform = 'translateY(' + (rect.top * 0.12) + 'px)';
      });
    }, { passive: true });
  }

  /* ── Magnetic hover on primary buttons ── */
  function initMagneticButtons() {
    if (prefersReduced || window.innerWidth < 768) return;

    document.querySelectorAll('.btn-primary, .nav-cta').forEach(function (btn) {
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

  /* ── Pipeline visual: chaotic-to-structured bar field for the platform panel ──
     Encodes "raw data in, training-ready data out" as a bar-density gradient:
     short/jittery bars on the left, tall/settled bars on the right. */
  function initPipelineCanvas() {
    var canvas = document.getElementById('pipeline-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [10, 10, 10] : [250, 250, 248];
    }

    var W, H, bars;
    var BAR_COUNT = 64;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      initBars();
    }

    function initBars() {
      bars = [];
      for (var i = 0; i < BAR_COUNT; i++) {
        var progress = i / (BAR_COUNT - 1);
        bars.push({
          progress: progress,
          phase: Math.random() * Math.PI * 2,
          speed: 0.012 + Math.random() * 0.016,
          baseHeight: 0.14 + Math.random() * (0.22 + progress * 0.5)
        });
      }
    }

    resize();
    window.addEventListener('resize', resize);

    function drawFrame(t) {
      ctx.clearRect(0, 0, W, H);
      var rgb = fgRGB();
      var gap = W / BAR_COUNT;
      var barW = Math.max(2, gap * 0.5);

      for (var i = 0; i < bars.length; i++) {
        var b = bars[i];
        var jitter = prefersReduced ? 0 : Math.sin(t * 0.03 + b.phase) * (0.1 * (1 - b.progress));
        var h = Math.max(0.05, Math.min(1, b.baseHeight + jitter));
        var barH = h * H * 0.7;
        var x = i * gap + gap * 0.25;
        var y = H - barH - H * 0.16;
        var alpha = 0.16 + b.progress * 0.5;

        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
        ctx.fillRect(x, y, barW, barH);
      }
    }

    if (prefersReduced) {
      drawFrame(0);
      document.addEventListener('concave:themechange', function () { drawFrame(0); });
      return;
    }

    var t = 0;
    function tick() {
      requestAnimationFrame(tick);
      t++;
      drawFrame(t);
    }
    tick();
  }

  /* ── Particle field: chaotic-to-organized data flow, used for hero + CTA canvases ──
     mode 'flow'  -> left side scattered/chaotic, right side settles into flowing lanes
     mode 'calm'  -> uniform, slow, organized lanes across the full width (CTA section) */
  function initParticleField(canvasId, mode) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || prefersReduced) return;
    var ctx = canvas.getContext('2d');

    function currentTextRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

    var W, H, nodes, laneHeight;
    var nodeCount = mode === 'calm' ? 42 : 68;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      laneHeight = H / 9;
      initNodes();
    }

    function initNodes() {
      nodes = [];
      for (var i = 0; i < nodeCount; i++) {
        var lane = Math.floor(Math.random() * 9);
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          lane: lane,
          laneY: (lane + 0.5) * laneHeight,
          jitterPhase: Math.random() * Math.PI * 2,
          jitterSpeed: 0.01 + Math.random() * 0.02,
          jitterAmp: 10 + Math.random() * 22,
          speed: mode === 'calm' ? (0.22 + Math.random() * 0.25) : (0.3 + Math.random() * 0.6),
          r: 1.3 + Math.random() * 1.6
        });
      }
    }

    resize();
    window.addEventListener('resize', resize);

    var t = 0;

    function organizedFactor(x) {
      if (mode === 'calm') return 1;
      var f = (x / W - 0.32) / 0.5;
      return Math.max(0, Math.min(1, f));
    }

    function tick() {
      requestAnimationFrame(tick);
      t++;
      ctx.clearRect(0, 0, W, H);
      var textRGB = currentTextRGB();

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.jitterPhase += n.jitterSpeed;
        n.x += n.speed;
        if (n.x > W + 20) {
          n.x = -20;
          n.y = Math.random() * H;
          n.lane = Math.floor(Math.random() * 9);
          n.laneY = (n.lane + 0.5) * laneHeight;
        }

        var of = organizedFactor(n.x);
        var chaosY = n.y + Math.sin(n.jitterPhase) * n.jitterAmp;
        var laneY = n.laneY + Math.sin(t * 0.02 + n.jitterPhase) * 4;
        var drawY = chaosY + (laneY - chaosY) * of;

        var baseAlpha = mode === 'calm' ? 0.5 : (0.18 + of * 0.55);
        var glowCol = textRGB;

        var gr = ctx.createRadialGradient(n.x, drawY, 0, n.x, drawY, n.r * 6);
        gr.addColorStop(0, rgba(glowCol, baseAlpha * 0.5));
        gr.addColorStop(1, rgba(glowCol, 0));
        ctx.beginPath();
        ctx.arc(n.x, drawY, n.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = gr;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, drawY, n.r, 0, Math.PI * 2);
        ctx.fillStyle = rgba(glowCol, Math.min(1, baseAlpha + 0.25));
        ctx.fill();

        n._drawY = drawY;
      }

      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var na = nodes[a], nb = nodes[b];
          var dx = na.x - nb.x, dy = na._drawY - nb._drawY;
          var d = Math.sqrt(dx * dx + dy * dy);
          var maxD = mode === 'calm' ? 90 : 70;
          if (d < maxD) {
            var ofA = organizedFactor(na.x);
            var alpha = (1 - d / maxD) * (mode === 'calm' ? 0.22 : 0.1 + ofA * 0.22);
            ctx.beginPath();
            ctx.moveTo(na.x, na._drawY);
            ctx.lineTo(nb.x, nb._drawY);
            ctx.strokeStyle = rgba(textRGB, alpha);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    tick();
  }

  function init() {
    initReveal();
    initNavScroll();
    initMobileMenu();
    initThemeToggle();
    initCounters();
    initSmoothAnchors();
    initBgParallax();
    initMagneticButtons();
    initPipelineCanvas();
    initParticleField('hero-canvas', 'flow');
    initParticleField('cta-canvas', 'calm');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
