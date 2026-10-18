(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Scroll-reveal via IntersectionObserver (opt-in via [data-reveal]) ──
     Replays every time, in both scroll directions: .is-visible is added
     on the way in and removed on the way out (no unobserve/one-shot), so
     scrolling back up into a section from below, or back down into it
     from above, re-triggers the same transition every time. The
     rootMargin trims the bottom of the intersection root, so a section
     only counts as "in" once it's scrolled a bit past the raw viewport
     edge rather than the instant a single pixel appears. */
  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    if (prefersReduced) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    /* Reveal once and stay revealed — toggling the class back off every
       time an element scrolls out of view made the fade/slide replay
       on every pass, which on a full-bleed image/video card means
       briefly seeing the plain page background through the gap while
       it's mid-transition (looks like a "blank space" flashing at the
       top/bottom whenever you scroll back across that section). */
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '-8% 0px -12% 0px' }
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
    /* Excludes .bg-media elements that live inside a rounded, clipped,
       edge-to-edge card (.layer-hero-card, .cta-final) — the media
       there is sized at exactly 100% of its box, so any parallax
       translateY drags its edge past the box boundary and exposes the
       plain background behind it in the gap. That gap is exactly what
       kept showing up as a "blank space" bug across this whole site —
       it was this scroll-driven inline transform all along, not a CSS
       issue, which is why nothing in platform.css could ever fix it. */
    var layers = Array.prototype.filter.call(document.querySelectorAll('.bg-media'), function (el) {
      return !el.closest('.layer-hero-card') && !el.closest('.cta-final');
    });
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

  /* ── Pipeline visual: chaotic-to-structured pixel field for the platform panel ──
     Encodes "raw data in, AI-ready data out" as a dot-density gradient:
     sparse, scattered pixels on the left, settling into a dense, even grid
     on the right. Cells twinkle in place rather than jumping like an
     equalizer, so it reads as background texture, not a distraction. */
  function initPipelineCanvas() {
    var canvas = document.getElementById('pipeline-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [10, 10, 10] : [250, 250, 248];
    }

    var W, H, cells;
    var CELL = 7;
    var GAP = 3;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      initCells();
    }

    function initCells() {
      cells = [];
      var step = CELL + GAP;
      var cols = Math.ceil(W / step);
      var rows = Math.ceil(H / step);
      for (var c = 0; c < cols; c++) {
        var progress = cols > 1 ? c / (cols - 1) : 1;
        for (var r = 0; r < rows; r++) {
          var density = 0.08 + progress * 0.72;
          if (Math.random() > density) continue;
          cells.push({
            x: c * step,
            y: r * step,
            progress: progress,
            phase: Math.random() * Math.PI * 2,
            speed: 0.01 + Math.random() * 0.02,
            baseAlpha: 0.1 + progress * 0.55 + Math.random() * 0.12
          });
        }
      }
    }

    resize();
    window.addEventListener('resize', resize);

    function drawFrame(t) {
      ctx.clearRect(0, 0, W, H);
      var rgb = fgRGB();

      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var twinkle = prefersReduced ? 0 : Math.sin(t * cell.speed + cell.phase) * 0.14;
        var alpha = Math.max(0.03, Math.min(0.85, cell.baseAlpha + twinkle));

        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
        ctx.fillRect(cell.x, cell.y, CELL, CELL);
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

  /* ── Who-block icon geometry: simple, precise vector shapes relevant to each
     team's work — a model graph, a data pipeline, an upward metric — rasterized
     to a mask so the pixel field can form the icon out of denser dots, the same
     way the platform pipeline canvas forms structure out of chaos. ── */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var WHO_ICONS = {
    /* ML Engineering — a fully-connected model graph */
    network: function (ctx, W, H) {
      var layers = [
        [[0.14, 0.30], [0.14, 0.52], [0.14, 0.74]],
        [[0.40, 0.20], [0.40, 0.42], [0.40, 0.64], [0.40, 0.86]],
        [[0.68, 0.38], [0.68, 0.66]]
      ];
      ctx.lineWidth = Math.max(1.5, W * 0.003);
      ctx.globalAlpha = 0.85;
      for (var l = 0; l < layers.length - 1; l++) {
        layers[l].forEach(function (a) {
          layers[l + 1].forEach(function (b) {
            ctx.beginPath();
            ctx.moveTo(a[0] * W, a[1] * H);
            ctx.lineTo(b[0] * W, b[1] * H);
            ctx.stroke();
          });
        });
      }
      ctx.globalAlpha = 1;
      var r = Math.max(4, W * 0.014);
      layers.reduce(function (a, b) { return a.concat(b); }, []).forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0] * W, p[1] * H, r, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    /* Data Operations — stacked pipeline layers flowing into a single output */
    pipeline: function (ctx, W, H) {
      var barX = 0.12, barW = 0.30, barH = 0.09;
      var ys = [0.18, 0.36, 0.54, 0.72];
      ys.forEach(function (y) {
        roundRect(ctx, barX * W, y * H, barW * W, barH * H, barH * H * 0.35);
        ctx.fill();
      });
      ctx.lineWidth = Math.max(1.5, W * 0.0028);
      ctx.beginPath();
      ctx.moveTo((barX + barW + 0.02) * W, 0.5 * H);
      ctx.lineTo(0.8 * W, 0.5 * H);
      ctx.stroke();
      var r2 = Math.max(5, W * 0.017);
      ctx.beginPath();
      ctx.arc(0.84 * W, 0.5 * H, r2, 0, Math.PI * 2);
      ctx.fill();
    },
    /* AI Product — ascending metrics, trending up */
    growth: function (ctx, W, H) {
      var xs = [0.16, 0.31, 0.46, 0.61, 0.76];
      var hs = [0.13, 0.25, 0.38, 0.53, 0.68];
      var base = 0.84, barW = 0.09;
      xs.forEach(function (x, i) {
        var h = hs[i];
        roundRect(ctx, x * W, (base - h) * H, barW * W, h * H, barW * W * 0.25);
        ctx.fill();
      });
      ctx.lineWidth = Math.max(1.5, W * 0.003);
      ctx.beginPath();
      ctx.moveTo(0.14 * W, 0.76 * H);
      ctx.lineTo(0.82 * W, 0.16 * H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.82 * W, 0.16 * H); ctx.lineTo(0.72 * W, 0.19 * H);
      ctx.moveTo(0.82 * W, 0.16 * H); ctx.lineTo(0.79 * W, 0.26 * H);
      ctx.stroke();
    },
    /* Ontologies — a branching classification tree */
    tree: function (ctx, W, H) {
      var root = [0.18, 0.5];
      var children = [[0.5, 0.22], [0.5, 0.5], [0.5, 0.78]];
      var grandkids = [[0.82, 0.14], [0.82, 0.30], [0.82, 0.66], [0.82, 0.82]];
      ctx.lineWidth = Math.max(1.5, W * 0.0028);
      ctx.globalAlpha = 0.85;
      children.forEach(function (c) {
        ctx.beginPath();
        ctx.moveTo(root[0] * W, root[1] * H);
        ctx.lineTo(c[0] * W, c[1] * H);
        ctx.stroke();
      });
      [[children[0], grandkids[0]], [children[0], grandkids[1]], [children[2], grandkids[2]], [children[2], grandkids[3]]].forEach(function (pair) {
        ctx.beginPath();
        ctx.moveTo(pair[0][0] * W, pair[0][1] * H);
        ctx.lineTo(pair[1][0] * W, pair[1][1] * H);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      var rBig = Math.max(4.5, W * 0.015), rSmall = Math.max(3, W * 0.009);
      ctx.beginPath(); ctx.arc(root[0] * W, root[1] * H, rBig, 0, Math.PI * 2); ctx.fill();
      children.forEach(function (c) {
        ctx.beginPath(); ctx.arc(c[0] * W, c[1] * H, rBig * 0.8, 0, Math.PI * 2); ctx.fill();
      });
      grandkids.forEach(function (g) {
        ctx.beginPath(); ctx.arc(g[0] * W, g[1] * H, rSmall, 0, Math.PI * 2); ctx.fill();
      });
    },
    /* AI-assisted labeling — a segmentation mask outline over an object */
    mask: function (ctx, W, H) {
      var pts = [[0.30, 0.22], [0.62, 0.16], [0.80, 0.34], [0.74, 0.62], [0.52, 0.82], [0.26, 0.70], [0.18, 0.42]];
      ctx.lineWidth = Math.max(1.5, W * 0.003);
      ctx.setLineDash([Math.max(3, W * 0.012), Math.max(3, W * 0.012)]);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      pts.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(p[0] * W, p[1] * H); else ctx.lineTo(p[0] * W, p[1] * H);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      var r = Math.max(3.5, W * 0.011);
      pts.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0] * W, p[1] * H, r, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    /* Outcome-Driven Queue Dispatch — a queued item promoted to the front,
       everything filled/thick so it survives the 7px dot sampling. */
    queueDispatch: function (ctx, W, H) {
      var y = 0.70;
      var xs = [0.20, 0.36, 0.52, 0.68, 0.84];
      var r = Math.max(6, W * 0.022);
      ctx.lineWidth = Math.max(5, W * 0.016);
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(xs[0] * W, y * H);
      ctx.lineTo(xs[xs.length - 1] * W, y * H);
      ctx.stroke();
      ctx.globalAlpha = 1;
      xs.forEach(function (x, i) {
        if (i === 3) return;
        ctx.beginPath();
        ctx.arc(x * W, y * H, r, 0, Math.PI * 2);
        ctx.fill();
      });
      var target = [0.22, 0.22];
      ctx.lineWidth = Math.max(5, W * 0.017);
      ctx.beginPath();
      ctx.moveTo(xs[3] * W, y * H);
      ctx.quadraticCurveTo(0.42 * W, 0.08 * H, target[0] * W, target[1] * H);
      ctx.stroke();
      ctx.lineWidth = Math.max(4, W * 0.014);
      ctx.beginPath();
      ctx.moveTo(target[0] * W, target[1] * H);
      ctx.lineTo((target[0] + 0.09) * W, (target[1] + 0.09) * H);
      ctx.moveTo(target[0] * W, target[1] * H);
      ctx.lineTo((target[0] + 0.11) * W, (target[1] - 0.01) * H);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(target[0] * W, target[1] * H, Math.max(8, W * 0.026), 0, Math.PI * 2);
      ctx.fill();
    },
    /* Contextual Correction Reasoning — a filled note with a check mark,
       the edit attached to it, both bold and solid. */
    correction: function (ctx, W, H) {
      var bx = 0.16, by = 0.14, bw = 0.56, bh = 0.40;
      roundRect(ctx, bx * W, by * H, bw * W, bh * H, bh * H * 0.18);
      ctx.globalAlpha = 0.28;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(4, W * 0.013);
      roundRect(ctx, bx * W, by * H, bw * W, bh * H, bh * H * 0.18);
      ctx.stroke();
      ctx.lineWidth = Math.max(6, W * 0.02);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo((bx + 0.10) * W, (by + bh * 0.52) * H);
      ctx.lineTo((bx + 0.24) * W, (by + bh * 0.68) * H);
      ctx.lineTo((bx + bw - 0.08) * W, (by + bh * 0.28) * H);
      ctx.stroke();
      ctx.save();
      ctx.translate(0.74 * W, 0.70 * H);
      ctx.rotate(-Math.PI / 4);
      roundRect(ctx, -0.028 * W, -0.19 * H, 0.056 * W, 0.30 * H, 0.018 * W);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-0.028 * W, 0.11 * H);
      ctx.lineTo(0, 0.20 * H);
      ctx.lineTo(0.028 * W, 0.11 * H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    /* Real-Time Inline Conflict Detection — two filled overlapping boxes,
       solid (not dashed — dashes vanish under dot sampling), flagged. */
    conflict: function (ctx, W, H) {
      ctx.globalAlpha = 0.85;
      roundRect(ctx, 0.14 * W, 0.18 * H, 0.42 * W, 0.42 * H, 0.03 * W);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      roundRect(ctx, 0.36 * W, 0.38 * H, 0.42 * W, 0.42 * H, 0.03 * W);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(4, W * 0.013);
      roundRect(ctx, 0.14 * W, 0.18 * H, 0.42 * W, 0.42 * H, 0.03 * W);
      ctx.stroke();
      roundRect(ctx, 0.36 * W, 0.38 * H, 0.42 * W, 0.42 * H, 0.03 * W);
      ctx.stroke();
      var cx = 0.5 * W, cy = 0.74 * H, s = 0.045 * W;
      roundRect(ctx, cx - s * 0.32, cy - s * 1.5, s * 0.64, s * 1.6, s * 0.2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.6, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    },
    /* Scrutiny-Preserving Bulk Actions — a filled funnel splitting into
       an approve path (check) and an inspect path (eye). */
    bulkActions: function (ctx, W, H) {
      ctx.beginPath();
      ctx.moveTo(0.20 * W, 0.14 * H);
      ctx.lineTo(0.80 * W, 0.14 * H);
      ctx.lineTo(0.58 * W, 0.40 * H);
      ctx.lineTo(0.58 * W, 0.52 * H);
      ctx.lineTo(0.42 * W, 0.52 * H);
      ctx.lineTo(0.42 * W, 0.40 * H);
      ctx.closePath();
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(5, W * 0.016);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0.50 * W, 0.52 * H);
      ctx.lineTo(0.28 * W, 0.74 * H);
      ctx.moveTo(0.50 * W, 0.52 * H);
      ctx.lineTo(0.72 * W, 0.74 * H);
      ctx.stroke();
      ctx.lineWidth = Math.max(6, W * 0.02);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0.20 * W, 0.80 * H);
      ctx.lineTo(0.26 * W, 0.87 * H);
      ctx.lineTo(0.38 * W, 0.72 * H);
      ctx.stroke();
      var r = Math.max(8, W * 0.028);
      ctx.beginPath();
      ctx.arc(0.72 * W, 0.80 * H, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0.72 * W, 0.80 * H, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    /* Visual Confidence Ranking — uneven bars with the weakest one flagged */
    confidenceRank: function (ctx, W, H) {
      var xs = [0.18, 0.33, 0.48, 0.63, 0.78];
      var hs = [0.30, 0.58, 0.20, 0.46, 0.66];
      var base = 0.82, barW = 0.09;
      xs.forEach(function (x, i) {
        var h = hs[i];
        roundRect(ctx, x * W, (base - h) * H, barW * W, h * H, barW * W * 0.25);
        ctx.fill();
      });
      var lowIdx = 2;
      var cx = (xs[lowIdx] + barW / 2) * W;
      var cy = (base - hs[lowIdx] - 0.09) * H;
      ctx.lineWidth = Math.max(1.5, W * 0.0028);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(6, W * 0.022), 0, Math.PI * 2);
      ctx.stroke();
    },
    /* Embedded Quality Telemetry — a pulse reading with a passed check */
    telemetry: function (ctx, W, H) {
      var bx = 0.12, by = 0.38, bw = 0.76, bh = 0.26;
      roundRect(ctx, bx * W, by * H, bw * W, bh * H, bh * H * 0.3);
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(4, W * 0.013);
      roundRect(ctx, bx * W, by * H, bw * W, bh * H, bh * H * 0.3);
      ctx.stroke();
      ctx.lineWidth = Math.max(5, W * 0.017);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo((bx + 0.05) * W, (by + bh / 2) * H);
      ctx.lineTo((bx + 0.24) * W, (by + bh / 2) * H);
      ctx.lineTo((bx + 0.32) * W, (by + 0.02) * H);
      ctx.lineTo((bx + 0.40) * W, (by + bh - 0.01) * H);
      ctx.lineTo((bx + 0.48) * W, (by + bh / 2) * H);
      ctx.lineTo((bx + bw - 0.05) * W, (by + bh / 2) * H);
      ctx.stroke();
      var cx = 0.5 * W, cy = 0.17 * H, s = 0.065 * W;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy - s * 0.4);
      ctx.lineTo(cx + s * 0.6, cy + s);
      ctx.lineTo(cx, cy + s * 1.3);
      ctx.lineTo(cx - s * 0.6, cy + s);
      ctx.lineTo(cx - s, cy - s * 0.4);
      ctx.closePath();
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(4, W * 0.013);
      ctx.stroke();
      ctx.lineWidth = Math.max(5, W * 0.016);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.35, cy);
      ctx.lineTo(cx - s * 0.05, cy + s * 0.35);
      ctx.lineTo(cx + s * 0.45, cy - s * 0.35);
      ctx.stroke();
    },
    /* Geospatial AI — a satellite, body + solar wings + antenna */
    geospatial: function (ctx, W, H) {
      /* body */
      roundRect(ctx, 0.42 * W, 0.38 * H, 0.18 * W, 0.26 * H, 0.025 * W);
      ctx.fill();
      /* solar wings with a cell grid cut into them */
      [0.06, 0.72].forEach(function (wx) {
        roundRect(ctx, wx * W, 0.42 * H, 0.22 * W, 0.18 * H, 0.01 * W);
        ctx.fill();
      });
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      [0.06, 0.72].forEach(function (wx) {
        for (var c = 1; c < 4; c++) {
          ctx.fillRect((wx + c * 0.22 / 4) * W - W * 0.0025, 0.42 * H, W * 0.005, 0.18 * H);
        }
        ctx.fillRect(wx * W, 0.505 * H - H * 0.003, 0.22 * W, H * 0.006);
      });
      for (var p = 1; p < 3; p++) {
        ctx.fillRect(0.42 * W, 0.38 * H + p * 0.26 * H / 3 - H * 0.003, 0.18 * W, H * 0.006);
      }
      ctx.restore();
      /* struts */
      ctx.lineWidth = Math.max(4, W * 0.013);
      ctx.beginPath();
      ctx.moveTo(0.28 * W, 0.51 * H); ctx.lineTo(0.42 * W, 0.51 * H);
      ctx.moveTo(0.60 * W, 0.51 * H); ctx.lineTo(0.72 * W, 0.51 * H);
      ctx.stroke();
      /* angled dish + mount */
      ctx.save();
      ctx.translate(0.51 * W, 0.28 * H);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, W * 0.085, H * 0.034, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = Math.max(4, W * 0.013);
      ctx.beginPath();
      ctx.moveTo(0.51 * W, 0.38 * H);
      ctx.lineTo(0.51 * W, 0.32 * H);
      ctx.stroke();
      /* trailing comm antennas */
      ctx.lineWidth = Math.max(3, W * 0.009);
      ctx.beginPath();
      ctx.moveTo(0.60 * W, 0.64 * H); ctx.lineTo(0.70 * W, 0.82 * H);
      ctx.moveTo(0.55 * W, 0.64 * H); ctx.lineTo(0.57 * W, 0.86 * H);
      ctx.stroke();
    },
    /* Automotive AI — a real side-profile hatchback: roofline, windows,
       door seam, mirror, and wheels sitting flush on the body baseline. */
    automotive: function (ctx, W, H) {
      ctx.beginPath();
      ctx.moveTo(0.06 * W, 0.62 * H);
      ctx.lineTo(0.06 * W, 0.56 * H);
      ctx.quadraticCurveTo(0.07 * W, 0.50 * H, 0.14 * W, 0.48 * H);
      ctx.lineTo(0.23 * W, 0.40 * H);
      ctx.quadraticCurveTo(0.28 * W, 0.30 * H, 0.37 * W, 0.27 * H);
      ctx.lineTo(0.43 * W, 0.19 * H);
      ctx.quadraticCurveTo(0.48 * W, 0.14 * H, 0.56 * W, 0.14 * H);
      ctx.lineTo(0.67 * W, 0.14 * H);
      ctx.quadraticCurveTo(0.75 * W, 0.14 * H, 0.79 * W, 0.20 * H);
      ctx.lineTo(0.84 * W, 0.29 * H);
      ctx.quadraticCurveTo(0.89 * W, 0.33 * H, 0.91 * W, 0.40 * H);
      ctx.lineTo(0.93 * W, 0.48 * H);
      ctx.quadraticCurveTo(0.95 * W, 0.50 * H, 0.95 * W, 0.56 * H);
      ctx.lineTo(0.95 * W, 0.62 * H);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(0.40 * W, 0.23 * H);
      ctx.lineTo(0.55 * W, 0.17 * H);
      ctx.lineTo(0.67 * W, 0.17 * H);
      ctx.lineTo(0.78 * W, 0.23 * H);
      ctx.lineTo(0.78 * W, 0.34 * H);
      ctx.lineTo(0.42 * W, 0.34 * H);
      ctx.closePath();
      ctx.fill();
      var wr0 = Math.max(9, W * 0.05);
      [0.26, 0.76].forEach(function (x) {
        ctx.beginPath();
        ctx.arc(x * W, 0.62 * H, wr0 * 0.42, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      ctx.lineWidth = Math.max(2.5, W * 0.008);
      ctx.beginPath();
      ctx.moveTo(0.57 * W, 0.34 * H);
      ctx.lineTo(0.57 * W, 0.60 * H);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0.40 * W, 0.22 * H, W * 0.02, H * 0.012, 0.3, 0, Math.PI * 2);
      ctx.fill();
      [0.26, 0.76].forEach(function (x) {
        ctx.beginPath();
        ctx.arc(x * W, 0.62 * H, wr0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      [0.26, 0.76].forEach(function (x) {
        ctx.beginPath();
        ctx.arc(x * W, 0.62 * H, wr0 * 0.42, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    },
    /* Industry AI — a factory building: sawtooth roofline, smokestack
       with rising smoke, and a row of window cut-outs along the wall. */
    industry: function (ctx, W, H) {
      ctx.fillRect(0.12 * W, 0.46 * H, 0.72 * W, 0.30 * H);
      ctx.beginPath();
      ctx.moveTo(0.12 * W, 0.46 * H);
      for (var i = 0; i < 4; i++) {
        var x0 = 0.12 + i * 0.18, x1 = x0 + 0.09, x2 = x0 + 0.18;
        ctx.lineTo(x0 * W, 0.46 * H);
        ctx.lineTo(x1 * W, 0.33 * H);
        ctx.lineTo(x2 * W, 0.46 * H);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(0.78 * W, 0.16 * H, 0.07 * W, 0.30 * H);
      [[0.815, 0.10], [0.85, 0.055], [0.875, 0.02]].forEach(function (p, i) {
        ctx.beginPath();
        ctx.arc(p[0] * W, p[1] * H, Math.max(5, W * 0.022 - i * W * 0.004), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      for (var wcol = 0; wcol < 4; wcol++) {
        ctx.fillRect((0.19 + wcol * 0.145) * W, 0.56 * H, 0.07 * W, 0.09 * H);
      }
      ctx.fillRect(0.12 * W, 0.66 * H, 0.72 * W, 0.03 * H);
      ctx.restore();
    },
    /* Agriculture AI — a tractor side-profile: cab, hood, big rear wheel,
       small front wheel, exhaust stack. */
    agriculture: function (ctx, W, H) {
      roundRect(ctx, 0.42 * W, 0.28 * H, 0.24 * W, 0.22 * H, 0.02 * W);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.18 * W, 0.50 * H);
      ctx.lineTo(0.42 * W, 0.50 * H);
      ctx.lineTo(0.42 * W, 0.40 * H);
      ctx.lineTo(0.66 * W, 0.40 * H);
      ctx.lineTo(0.66 * W, 0.50 * H);
      ctx.lineTo(0.82 * W, 0.50 * H);
      ctx.lineTo(0.82 * W, 0.58 * H);
      ctx.lineTo(0.18 * W, 0.58 * H);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(0.60 * W, 0.14 * H, 0.035 * W, 0.16 * H);
      var rBig = Math.max(15, W * 0.095);
      var rSmall = Math.max(8, W * 0.05);
      ctx.beginPath();
      ctx.arc(0.30 * W, 0.62 * H, rBig, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0.76 * W, 0.65 * H, rSmall, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(0.30 * W, 0.62 * H, rBig * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0.76 * W, 0.65 * H, rSmall * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(0.47 * W, 0.33 * H, 0.14 * W, 0.11 * H);
      ctx.restore();
    },
    /* Document AI — three slightly fanned, stacked report pages, the
       top one with real text lines cut out of it. */
    document2: function (ctx, W, H) {
      var sheets = [
        { dx: 0.06, dy: 0.10, rot: -0.07, alpha: 0.5 },
        { dx: 0.02, dy: 0.04, rot: 0.04, alpha: 0.72 },
        { dx: 0, dy: 0, rot: -0.015, alpha: 1 }
      ];
      sheets.forEach(function (s, i) {
        ctx.save();
        ctx.translate((0.5 + s.dx) * W, (0.52 + s.dy) * H);
        ctx.rotate(s.rot);
        ctx.globalAlpha = s.alpha;
        roundRect(ctx, -0.22 * W, -0.30 * H, 0.44 * W, 0.58 * H, 0.015 * W);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (i === sheets.length - 1) {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = Math.max(4, W * 0.014);
          [-0.16, -0.06, 0.04, 0.14, 0.22].forEach(function (ly, li) {
            ctx.beginPath();
            ctx.moveTo(-0.14 * W, ly * H);
            ctx.lineTo((li === 4 ? -0.02 : 0.14) * W, ly * H);
            ctx.stroke();
          });
          ctx.restore();
        }
        ctx.restore();
      });
    },
    /* Energy sector — a wind turbine: tower, nacelle, three blades. */
    energy: function (ctx, W, H) {
      ctx.beginPath();
      ctx.moveTo(0.485 * W, 0.86 * H);
      ctx.lineTo(0.515 * W, 0.86 * H);
      ctx.lineTo(0.505 * W, 0.30 * H);
      ctx.lineTo(0.495 * W, 0.30 * H);
      ctx.closePath();
      ctx.fill();
      roundRect(ctx, 0.45 * W, 0.265 * H, 0.14 * W, 0.05 * H, 0.012 * W);
      ctx.fill();
      ctx.save();
      ctx.translate(0.50 * W, 0.29 * H);
      for (var i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(W * 0.028, -H * 0.13, W * 0.012, -H * 0.30);
        ctx.quadraticCurveTo(-W * 0.012, -H * 0.13, 0, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
    /* Real-Time Inline Conflict Detection — a bold warning triangle, a
       deliberately different silhouette (not another rectangle) with
       a thick exclamation mark punched through it. */
    warningFlag: function (ctx, W, H) {
      ctx.beginPath();
      ctx.moveTo(0.5 * W, 0.14 * H);
      ctx.lineTo(0.86 * W, 0.80 * H);
      ctx.lineTo(0.14 * W, 0.80 * H);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      var s = 0.05 * W;
      roundRect(ctx, 0.5 * W - s * 0.32, 0.34 * H, s * 0.64, s * 1.9, s * 0.2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0.5 * W, 0.68 * H, s * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  /* ── Who-block texture: pixel-dot field (same language as the platform
     canvas), with density boosted inside the rasterized icon mask so the
     shape reads as a denser cluster of dots against a sparse ambient field. */
  function initWhoCanvas(canvas, iconKey, opts) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var drawIcon = WHO_ICONS[iconKey];

    function fgRGB() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (opts && opts.invert) isDark = !isDark;
      return isDark ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H, cells, mask;
    var CELL = (opts && opts.cell) || 5, GAP = (opts && opts.gap) || 2;

    function buildMask() {
      if (!drawIcon) { mask = null; return; }
      var off = document.createElement('canvas');
      off.width = W; off.height = H;
      var octx = off.getContext('2d');
      octx.fillStyle = '#fff';
      octx.strokeStyle = '#fff';
      drawIcon(octx, W, H);
      mask = octx.getImageData(0, 0, W, H).data;
    }

    function maskAlphaAt(x, y) {
      if (!mask) return 0;
      var px = Math.min(W - 1, Math.max(0, Math.round(x)));
      var py = Math.min(H - 1, Math.max(0, Math.round(y)));
      return mask[(py * W + px) * 4 + 3];
    }

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      if (W < 2 || H < 2) return;
      buildMask();
      initCells();
    }

    function initCells() {
      cells = [];
      var step = CELL + GAP;
      var cols = Math.ceil(W / step);
      var rows = Math.ceil(H / step);
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < rows; r++) {
          var x = c * step + CELL / 2;
          var y = r * step + CELL / 2;
          var inShape = maskAlphaAt(x, y) > 40;
          var density = inShape ? 0.92 : 0.05;
          if (Math.random() > density) continue;
          cells.push({
            x: c * step,
            y: r * step,
            inShape: inShape,
            phase: Math.random() * Math.PI * 2,
            speed: 0.008 + Math.random() * 0.014,
            baseAlpha: inShape ? (0.32 + Math.random() * 0.35) : (0.05 + Math.random() * 0.09)
          });
        }
      }
    }

    /* The accordion expand/collapse resizes this canvas via a CSS `flex`
       transition, which fires no window resize event — watch the element
       itself, debounced, so the mask rebuilds once the transition settles. */
    resize();
    if (window.ResizeObserver) {
      var resizeTimer;
      new ResizeObserver(function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 120);
      }).observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }

    function drawFrame(t) {
      ctx.clearRect(0, 0, W, H);
      var rgb = fgRGB();
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var twinkle = prefersReduced ? 0 : Math.sin(t * cell.speed + cell.phase) * (cell.inShape ? 0.1 : 0.04);
        var alpha = Math.max(0.02, Math.min(0.85, cell.baseAlpha + twinkle));
        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
        ctx.fillRect(cell.x, cell.y, CELL, CELL);
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

  /* ── Who-blocks: accordion-style expand on hover/focus, last panel open by default ── */
  function initWhoBlocks() {
    var group = document.querySelector('.who-blocks');
    var blocks = document.querySelectorAll('.who-block');
    if (!group || !blocks.length) return;

    var defaultActive = blocks[blocks.length - 1];
    defaultActive.classList.add('is-active');

    blocks.forEach(function (block) {
      var canvas = block.querySelector('.who-canvas');
      initWhoCanvas(canvas, canvas ? canvas.getAttribute('data-icon') : null);
    });

    function activate(block) {
      blocks.forEach(function (b) { b.classList.remove('is-active'); });
      block.classList.add('is-active');
    }

    blocks.forEach(function (block) {
      block.addEventListener('mouseenter', function () { activate(block); });
      block.addEventListener('focus', function () { activate(block); });
    });

    group.addEventListener('mouseleave', function () { activate(defaultActive); });
  }

  /* ── Review bento: a STATIC grid version of the who-canvas pixel-mask
     technique above — every card keeps its own drawn icon and its own
     fixed size all the time (no accordion expand), just a hover lift/glow.
     initWhoCanvas itself has no dependency on .who-block, so it's reused
     as-is here for the exact same dot-field + rasterized-icon rendering. */
  function initReviewBento() {
    var cards = document.querySelectorAll('.review-card');
    if (!cards.length) return;
    cards.forEach(function (card) {
      var canvas = card.querySelector('.review-card-canvas');
      initWhoCanvas(canvas, canvas ? canvas.getAttribute('data-icon') : null);
    });
  }

  /* ── Recipe grid pixel field (Transform page "Operations"): same
     renderer again, no icon key — the existing SVG icon stays as the
     actual symbol, this is only the faint ambient dot texture behind it. */
  function initRecipeCanvases() {
    var canvases = document.querySelectorAll('.recipe-card-canvas');
    canvases.forEach(function (canvas) { initWhoCanvas(canvas, null); });
  }

  /* ── Govern page "Why It Matters" circles: same ambient dot-field
     renderer, but each circle's own fill is already inverted (a var
     (--text) disc with var(--bg) text on it), so the dots need to be
     drawn in the INVERTED color too (opts.invert) or they'd vanish
     into a same-color background. */
  function initGovernWhyCircles() {
    var canvases = document.querySelectorAll('.govern-why-canvas');
    canvases.forEach(function (canvas) { initWhoCanvas(canvas, null, { invert: true }); });
  }

  /* ── About page "What We Do" circles and "Values" boxes: same
     inverted-fill pixel-dot treatment as the Govern circles above,
     just reused on a different page/shape. */
  function initWhatCircles() {
    var canvases = document.querySelectorAll('.what-circle-canvas');
    canvases.forEach(function (canvas) { initWhoCanvas(canvas, null, { invert: true }); });
  }
  function initValueBoxes() {
    var canvases = document.querySelectorAll('.value-box-canvas');
    canvases.forEach(function (canvas) { initWhoCanvas(canvas, null, { invert: true }); });
  }

  /* ── Platform pages' "What It Does" black intro panel: same inverted
     pixel-dot texture, reused across Transform/Label/Version/Observe/
     Govern since they all share .intro-diagram-copy. */
  function initIntroDiagramCopy() {
    var canvases = document.querySelectorAll('.intro-diagram-copy-canvas');
    canvases.forEach(function (canvas) { initWhoCanvas(canvas, null, { invert: true }); });
  }

  /* ── Closed-loop diagram: a dotted pixel ring with a comet-trail dot that
     continuously travels it, plus a faint interior data field — the same
     chaotic/structured pixel language, applied to the "loop never stops"
     idea. The clean SVG ring stays underneath for the crisp static line. */
  function initLoopCanvas(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H, cx, cy, radius, field;
    var RING_RATIO = 125 / 300;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      cx = W / 2; cy = H / 2;
      radius = Math.min(W, H) * RING_RATIO;
      buildField();
    }

    function buildField() {
      field = [];
      var count = 70;
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var d = Math.sqrt(Math.random()) * (radius * 0.82);
        field.push({
          x: cx + Math.cos(a) * d,
          y: cy + Math.sin(a) * d,
          phase: Math.random() * Math.PI * 2,
          speed: 0.01 + Math.random() * 0.02,
          baseAlpha: 0.03 + Math.random() * 0.07,
          size: 2 + Math.random() * 2
        });
      }
    }

    resize();
    window.addEventListener('resize', resize);

    var trail = [];
    var TRAIL_LEN = 18;

    function drawFrame(t) {
      ctx.clearRect(0, 0, W, H);
      var rgb = fgRGB();
      var rgba = function (a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; };

      for (var i = 0; i < field.length; i++) {
        var f = field[i];
        var twinkle = prefersReduced ? 0 : Math.sin(t * f.speed + f.phase) * 0.03;
        ctx.fillStyle = rgba(Math.max(0.01, f.baseAlpha + twinkle));
        ctx.fillRect(f.x, f.y, f.size, f.size);
      }

      var ringDots = 90;
      for (var j = 0; j < ringDots; j++) {
        var ang = (j / ringDots) * Math.PI * 2;
        ctx.fillStyle = rgba(0.14);
        ctx.fillRect(cx + Math.cos(ang) * radius - 1, cy + Math.sin(ang) * radius - 1, 2, 2);
      }

      if (prefersReduced) {
        var a0 = -Math.PI / 2;
        ctx.fillStyle = rgba(0.85);
        var px0 = cx + Math.cos(a0) * radius, py0 = cy + Math.sin(a0) * radius;
        ctx.fillRect(px0 - 3, py0 - 3, 6, 6);
        return;
      }

      var angle = (-Math.PI / 2) + t * 0.007;
      trail.unshift(angle);
      if (trail.length > TRAIL_LEN) trail.pop();
      for (var k = 0; k < trail.length; k++) {
        var fade = 1 - k / trail.length;
        var px = cx + Math.cos(trail[k]) * radius, py = cy + Math.sin(trail[k]) * radius;
        var size = 2 + fade * 3;
        ctx.fillStyle = rgba(fade * 0.85);
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
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

  /* ── Hero mosaic: annotation screenshots/clips pop in and out at scattered
     positions around the hero, independent of each other, continuously.
     Images hold for IMAGE_MS; videos always play to completion before the
     slot moves on, however long that takes.

     To add more assets later: drop the file in /imgbgm and add one line to
     HERO_MOSAIC_MEDIA below — nothing else needs to change. Desktop only
     (disabled under 900px) and skipped entirely under prefers-reduced-motion,
     same as the rest of this file's motion. */
  var HERO_MOSAIC_MEDIA = [
    { type: 'image', src: '/imgbgm/img-segment-street-runner.png' },
    { type: 'image', src: '/imgbgm/img-segment-surfboard.png' },
    { type: 'image', src: '/imgbgm/img-segment-marathon.png' },
    { type: 'image', src: '/imgbgm/img-segment-portrait-duo.png' },
    { type: 'image', src: '/imgbgm/img-segment-street-scene.png' },
    { type: 'image', src: '/imgbgm/img-segment-palms.png' },
    { type: 'image', src: '/imgbgm/img-segment-plaza.png' },
    { type: 'image', src: '/imgbgm/img-audio-diarization.png' },
    { type: 'image', src: '/imgbgm/img-audio-segments.png' },
    { type: 'image', src: '/imgbgm/img-keypoints-face.png' },
    { type: 'image', src: '/imgbgm/img-rlhf-compare.png' },
    { type: 'image', src: '/imgbgm/img-before-after-runner.png' },
    { type: 'video', src: '/imgbgm/video-annotated-01.mp4' },
    { type: 'video', src: '/imgbgm/video-annotated-02.mp4' },
    { type: 'video', src: '/imgbgm/video-annotated-03.mp4' },
    { type: 'video', src: '/imgbgm/video-annotated-04.mp4' },
    { type: 'video', src: '/imgbgm/video-annotated-05.mp4' },
    { type: 'video', src: '/imgbgm/video-annotated-06.mp4' },
    { type: 'image', src: '/imgbgm/screen1.png' },
    { type: 'image', src: '/imgbgm/screen2.png' },
    { type: 'image', src: '/imgbgm/screen3.png' },
    { type: 'image', src: '/imgbgm/screen4.png' },
    { type: 'image', src: '/imgbgm/screen5.png' },
    { type: 'image', src: '/imgbgm/screen6.png' },
    { type: 'image', src: '/imgbgm/screen7.png' },
    { type: 'image', src: '/imgbgm/screen8.png' },
    { type: 'video', src: '/imgbgm/lscreenvideo.mp4' },
    { type: 'video', src: '/imgbgm/new1.mp4' },
    { type: 'video', src: '/imgbgm/new-10.mp4' },
    { type: 'video', src: '/imgbgm/new-11.mp4' },
    { type: 'image', src: '/imgbgm/new-2.png' },
    { type: 'image', src: '/imgbgm/new-3.png' },
    { type: 'image', src: '/imgbgm/new-4.png' },
    { type: 'image', src: '/imgbgm/new-5.png' },
    { type: 'image', src: '/imgbgm/new-6.png' },
    { type: 'image', src: '/imgbgm/new-7.png' },
    { type: 'image', src: '/imgbgm/new-8.png' },
    { type: 'image', src: '/imgbgm/new-9.png' },
    { type: 'image', src: '/imgbgm/audioclassification-dark.png' },
    { type: 'image', src: '/imgbgm/audiosegmentation-bright.png' },
    { type: 'image', src: '/imgbgm/speakerdiazartion-bright.png' },
    { type: 'image', src: '/imgbgm/transcription-bright.png' },
    { type: 'image', src: '/imgbgm/NER-dark.png' },
    { type: 'image', src: '/imgbgm/QA-bright.png' },
    { type: 'image', src: '/imgbgm/relationextraction-dark.png' },
    { type: 'video', src: '/imgbgm/temporalsegmentation-dark.mp4' },
    { type: 'video', src: '/imgbgm/frameannotation-bright.mp4' },
    { type: 'image', src: '/imgbgm/instance.png' }
  ];

  /* Slots are generated on load, not hand-placed — an ellipse/ring of fixed
     points always reads as a circle no matter how many points you use. A
     jittered grid instead covers the whole rectangle (corners included),
     skipping only the cells that overlap the headline/subtitle/button, and
     comes out different every page load since the jitter is randomized. */
  function buildHeroMosaicSlots() {
    var cols = 7, rows = 5;
    var safe = { left: 24, right: 76, top: 27, bottom: 78 };
    var cellW = 100 / cols, cellH = 100 / rows;
    var slots = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cx = c * cellW + cellW / 2;
        var cy = r * cellH + cellH / 2;
        if (cx > safe.left && cx < safe.right && cy > safe.top && cy < safe.bottom) continue;
        var jx = (Math.random() - 0.5) * cellW * 0.7;
        var jy = (Math.random() - 0.5) * cellH * 0.7;
        var top = Math.min(94, Math.max(3, cy + jy));
        var left = Math.min(96, Math.max(2, cx + jx));
        var w = 110 + Math.round(Math.random() * 90);
        var h = 100 + Math.round(Math.random() * 90);
        slots.push({ top: top + '%', left: left + '%', w: w, h: h });
      }
    }
    return slots;
  }

  /* ── Text page "Task Types" flashcard carousel: one card active at a
     time, auto-advancing on an interval, previous/next cards faded and
     offset behind it. Pauses on hover, resumes on leave; a dot click
     jumps straight to that card and resets the timer. Reduced-motion
     just shows the first card, no timer. */
  /* ── Text page "Task Types" 3D coverflow: three FIXED roles — active
     (center), incoming (left, about to become active), outgoing
     (right, was just active) — and every tick the index rotates which
     card occupies which role. No track, no scrolling, no clone/snap:
     wrapping from the last card back to the first is just the same
     modulo arithmetic as any other step, so there's no seam to hide
     in the first place. Content flow is left → center → right, per
     spec. */
  function initTaskFlashcards() {
    var stages = document.querySelectorAll('.task-flashcards');
    stages.forEach(function (root) {
      var cards = Array.prototype.slice.call(root.querySelectorAll('.task-flashcard'));
      var dots = root.querySelectorAll('.task-flashcard-dot');
      var n = cards.length;
      if (!n) return;
      var active = 0;

      function render() {
        cards.forEach(function (card, i) {
          card.classList.remove('is-active', 'is-incoming', 'is-outgoing');
          if (i === active) card.classList.add('is-active');
          else if (i === (active + 1) % n) card.classList.add('is-incoming');
          else if (i === (active - 1 + n) % n) card.classList.add('is-outgoing');
        });
        dots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === active); });
      }
      render();

      function advance() { active = (active + 1) % n; render(); }
      function jumpTo(i) { active = i; render(); }

      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () {
          jumpTo(i);
          restart();
        });
      });

      if (prefersReduced) return;

      var timer = null;
      function restart() { stop(); timer = setInterval(advance, 2800); }
      function stop() { if (timer) clearInterval(timer); }
      restart();

      root.addEventListener('mouseenter', stop);
      root.addEventListener('mouseleave', restart);
    });
  }

  function initHeroMosaic() {
    var root = document.getElementById('hero-mosaic');
    if (!root || prefersReduced || window.innerWidth < 900) return;

    var HERO_MOSAIC_SLOTS = buildHeroMosaicSlots();
    var IMAGE_MS = 6000;
    var MAX_CONCURRENT_VIDEOS = 2;
    var activeVideoCount = 0;
    var recent = [];
    var heroVisible = true;

    function pickAsset() {
      var pool = HERO_MOSAIC_MEDIA.filter(function (m) { return recent.indexOf(m.src) === -1; });
      if (!pool.length) pool = HERO_MOSAIC_MEDIA;
      var pick = pool[Math.floor(Math.random() * pool.length)];
      recent.push(pick.src);
      if (recent.length > 5) recent.shift();
      return pick;
    }

    HERO_MOSAIC_SLOTS.forEach(function (slot, i) {
      var card = document.createElement('div');
      card.className = 'mosaic-card';
      card.style.top = slot.top;
      card.style.left = slot.left;
      card.style.width = slot.w + 'px';
      card.style.height = slot.h + 'px';
      root.appendChild(card);

      function cycle() {
        var asset = pickAsset();

        if (asset.type === 'video' && activeVideoCount >= MAX_CONCURRENT_VIDEOS) {
          setTimeout(cycle, 1500 + Math.random() * 1500);
          return;
        }

        card.innerHTML = '';
        var el;
        if (asset.type === 'video') {
          el = document.createElement('video');
          el.src = encodeURI(asset.src);
          el.muted = true;
          el.playsInline = true;
          el.loop = false;
          activeVideoCount++;
          if (heroVisible) el.play().catch(function () {});
        } else {
          el = document.createElement('img');
          el.src = encodeURI(asset.src);
          el.alt = '';
        }
        card.appendChild(el);
        requestAnimationFrame(function () { card.classList.add('is-visible'); });

        function finish() {
          card.classList.remove('is-visible');
          if (asset.type === 'video') activeVideoCount--;
          setTimeout(function () {
            card.innerHTML = '';
            cycle();
          }, 700 + Math.random() * 2200);
        }

        if (asset.type === 'video') {
          el.addEventListener('ended', finish);
          el.addEventListener('error', finish);
        } else {
          setTimeout(finish, IMAGE_MS);
        }
      }

      setTimeout(cycle, i * 350 + Math.random() * 1800);
    });

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
        root.querySelectorAll('video').forEach(function (v) {
          if (heroVisible) v.play().catch(function () {});
          else v.pause();
        });
      }, { threshold: 0.1 }).observe(document.querySelector('.hero'));
    }
  }

  /* ── Modality branches: tap-to-toggle for touch devices, where :hover doesn't stick ── */
  function initModalityBranches() {
    var items = document.querySelectorAll('.modality-item');
    if (!items.length) return;

    items.forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        var wasOpen = item.classList.contains('is-open');
        items.forEach(function (i) { i.classList.remove('is-open'); });
        if (!wasOpen) item.classList.add('is-open');
      });
    });

    document.addEventListener('click', function () {
      items.forEach(function (i) { i.classList.remove('is-open'); });
    });
  }

  function init() {
    initReveal();
    initNavScroll();
    initMobileMenu();
    initThemeToggle();
    initCounters();
    initSmoothAnchors();
    initBgParallax();
    initPipelineCanvas();
    initModalityBranches();
    initWhoBlocks();
    initReviewBento();
    initRecipeCanvases();
    initGovernWhyCircles();
    initWhatCircles();
    initValueBoxes();
    initIntroDiagramCopy();
    initLoopCanvas(document.querySelector('.loop-canvas'));
    initHeroMosaic();
    initTaskFlashcards();
    initParticleField('hero-canvas', 'flow');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
