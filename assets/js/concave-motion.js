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

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          } else {
            entry.target.classList.remove('is-visible');
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
    }
  };

  /* ── Who-block texture: pixel-dot field (same language as the platform
     canvas), with density boosted inside the rasterized icon mask so the
     shape reads as a denser cluster of dots against a sparse ambient field. */
  function initWhoCanvas(canvas, iconKey) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var drawIcon = WHO_ICONS[iconKey];

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H, cells, mask;
    var CELL = 5, GAP = 2;

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
    { type: 'video', src: '/imgbgm/lscreenvideo.mp4' }
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
    initLoopCanvas(document.querySelector('.loop-canvas'));
    initHeroMosaic();
    initParticleField('hero-canvas', 'flow');
    initParticleField('cta-canvas', 'calm');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
