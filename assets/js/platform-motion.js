(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Five Layers: scroll-driven sticky diagram + text ──
     .layer-scroll is a tall (620vh) container; .layer-sticky pins to the
     viewport while it scrolls past. Scroll position within that container
     maps to one of 6 slides (intro + 5 layers), each updating the copy,
     progress dots, and which pentagon node is highlighted — plus a small
     rotation on the diagram so it visibly "turns" toward the active layer.
     Prev/next buttons scroll the window to the matching position instead of
     just swapping content, so scroll position and displayed slide never
     disagree. Desktop only (≥900px) — below that, a plain stacked list
     (.layer-mobile) is shown instead; see the CSS media query. */
  var LAYER_SLIDES = [
    { intro: true, badge: '', tagline: '', heading: 'Run your entire data lifecycle in one place.', desc: 'Most teams stitch together fragmented toolchains and call it a Data Ops stack. Datalier gives you a unified data infrastrucutre foundation transforming raw data into AI ready data for Model training built to work cohesively from day one.', href: '/platform', linkText: '', node: -1 },
    { intro: false, badge: 'Layer 1 of 5', tagline: 'Clean. Validate. Prepare.', heading: 'Transform', desc: 'Remove duplicates, detect personally identifiable information (PII), validate field integrity, normalise LLM schema score data quality and many more, before any labeling begins.', href: '/platform/transform', linkText: 'Explore Transform →', node: 0 },
    { intro: false, badge: 'Layer 2 of 5', tagline: 'Annotate. Verify. Certify.', heading: 'Label', desc: 'A multi-engine orchestration layer that routes each data point to the appropriate AI Engine. Labels are backed by confidences and those below the threesold go to annotation reviews before pushing it into next layer. Enriched with automation and focused on quality across four data modalities.', href: '/platform/label', linkText: 'Explore Label →', node: 1 },
    { intro: false, badge: 'Layer 3 of 5', tagline: 'Snapshot. Trace. Export.', heading: 'Version', desc: 'Every processed AI-ready dataset is frozen into an immutable, hash-verified snapshot, with a full lineage for traceability and get AI-ready datasets exported in relevant form.', href: '/platform/version', linkText: 'Explore Version →', node: 2 },
    { intro: false, badge: 'Layer 4 of 5', tagline: 'Monitor. Detect. Correct.', heading: 'Observe', desc: 'Get Models registered, to pull prediction logs from deployed models back into the platform. Detect drifts to identify when and where performance is degrading, and route rectified dataset back through labeling pipeline back into the model training enhancing accuracy.', href: '/platform/observe', linkText: 'Explore Observe →', node: 3 },
    { intro: false, badge: 'Layer 5 of 5', tagline: 'Control. Audit. Comply.', heading: 'Govern', desc: 'Role-based permissions, an immutable audit log, and regulatory tags that travel with the data wherever it moves. Ensuring trust in data binding the focus on reliability and sustainability of AI models.', href: '/platform/govern', linkText: 'Explore Govern →', node: 4 }
  ];

  /* Sphere landmark for each layer — a (lat, lon) surface coordinate, spread
     around the globe. When a slide activates node N, the sphere rotates so
     that landmark's longitude faces the viewer dead-on. */
  var LAYER_LANDMARKS = [
    { lat: 6, lon: 0 },
    { lat: -8, lon: 72 },
    { lat: 10, lon: 144 },
    { lat: -6, lon: 216 },
    { lat: 8, lon: 288 }
  ];

  /* ── Rotating dot-sphere (canvas) ──
     A point cloud on a unit sphere (lat/lon grid, denser near the equator,
     thinner near the poles — the same look as a wireframe globe), rotated
     around the vertical axis and projected orthographically. Points facing
     away are dropped so only the near hemisphere renders. On the intro slide
     it auto-rotates continuously; once a layer is active, it eases to the
     angle that brings that layer's landmark to dead-center front and stays
     there, brightening the dots in a radius around it. Returns a controller
     so initLayerScroll can tell it which layer is active. */
  function initLayerSphere(canvas) {
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H, R, points;

    function buildPoints() {
      points = [];
      var latSteps = 26;
      for (var i = 0; i <= latSteps; i++) {
        var latDeg = -90 + (180 / latSteps) * i;
        var latRad = latDeg * Math.PI / 180;
        var ringScale = Math.cos(latRad);
        var count = Math.max(3, Math.round(ringScale * 52));
        for (var j = 0; j < count; j++) {
          points.push({ lat: latRad, lon: (2 * Math.PI / count) * j });
        }
      }
    }

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      R = Math.min(W, H) * 0.46;
      buildPoints();
    }

    resize();
    window.addEventListener('resize', resize);

    var rotY = 0;
    var targetRotY = 0;
    var autoRotate = true;
    var activeIndex = -1;

    function angularDist(aLat, aLon, bLat, bLon) {
      var dLon = Math.atan2(Math.sin(aLon - bLon), Math.cos(aLon - bLon));
      var dLat = aLat - bLat;
      return Math.sqrt(dLon * dLon * Math.cos(aLat) * Math.cos(aLat) + dLat * dLat);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var cx = W / 2, cy = H / 2;
      var rgb = fgRGB();
      var lm = activeIndex >= 0 ? LAYER_LANDMARKS[activeIndex] : null;
      var lmLat = lm ? lm.lat * Math.PI / 180 : 0;
      var lmLon = lm ? lm.lon * Math.PI / 180 : 0;
      var cosR = Math.cos(rotY), sinR = Math.sin(rotY);

      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var x = Math.cos(p.lat) * Math.sin(p.lon);
        var z = Math.cos(p.lat) * Math.cos(p.lon);
        var y = Math.sin(p.lat);
        var xr = x * cosR + z * sinR;
        var zr = z * cosR - x * sinR;
        if (zr < -0.1) continue;

        var depthT = Math.max(0, Math.min(1, (zr + 1) / 2));
        var alpha = 0.1 + depthT * 0.42;
        var size = 0.9 + depthT * 1.5;

        if (lm) {
          var dist = angularDist(p.lat, p.lon, lmLat, lmLon);
          if (dist < 0.5) {
            var boost = 1 - dist / 0.5;
            alpha = Math.min(1, alpha + boost * 0.55);
            size += boost * 1.6;
          }
        }

        var sx = cx + xr * R;
        var sy = cy - y * R;
        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(2) + ')';
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }

      for (var k = 0; k < LAYER_LANDMARKS.length; k++) {
        var l = LAYER_LANDMARKS[k];
        var llat = l.lat * Math.PI / 180, llon = l.lon * Math.PI / 180;
        var lx = Math.cos(llat) * Math.sin(llon);
        var lz = Math.cos(llat) * Math.cos(llon);
        var ly = Math.sin(llat);
        var lxr = lx * cosR + lz * sinR;
        var lzr = lz * cosR - lx * sinR;
        if (lzr < 0.45) continue;
        var lsx = cx + lxr * R;
        var lsy = cy - ly * R;
        var isActive = k === activeIndex;
        var t = Math.min(1, (lzr - 0.45) / 0.55);
        ctx.font = (isActive ? '800 14px' : '600 11px') + " 'Inter', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (t * (isActive ? 1 : 0.55)).toFixed(2) + ')';
        ctx.fillText(LAYER_SLIDES[k + 1] ? LAYER_SLIDES[k + 1].heading : '', lsx, lsy - (isActive ? 20 : 16));
      }
    }

    function tick() {
      requestAnimationFrame(tick);
      if (prefersReduced) { draw(); return; }
      if (autoRotate) {
        rotY += 0.0032;
      } else {
        var diff = targetRotY - rotY;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        // The easing above asymptotically approaches the target but never
        // quite lands on it — left alone, the "settled" label would drift by
        // a sub-pixel amount forever. Snap once close enough so the active
        // layer's label is genuinely constant (bit-identical every frame)
        // for as long as that slide is showing, not just visually close.
        if (Math.abs(diff) > 0.0006) {
          rotY += diff * 0.055;
        } else {
          rotY = targetRotY;
        }
      }
      draw();
    }
    tick();

    return {
      setActive: function (index) {
        activeIndex = index;
        if (index < 0) {
          autoRotate = true;
        } else {
          autoRotate = false;
          targetRotY = -(LAYER_LANDMARKS[index].lon * Math.PI / 180);
        }
      }
    };
  }

  function initLayerScroll() {
    var container = document.getElementById('layerScroll');
    if (!container || window.innerWidth < 900) return;

    var badge = document.getElementById('layerBadge');
    var badgeText = document.getElementById('layerBadgeText');
    var tagline = document.getElementById('layerTagline');
    var heading = document.getElementById('layerHeading');
    var desc = document.getElementById('layerDesc');
    var link = document.getElementById('layerLink');
    var progressRow = document.getElementById('layerProgressRow');
    var progressSegs = progressRow ? progressRow.querySelectorAll('.layer-progress-seg') : [];
    var scrollHint = document.getElementById('layerScrollHint');
    var prevBtn = container.querySelector('.layer-prev');
    var nextBtn = container.querySelector('.layer-next');
    if (!heading || !desc) return;

    var sphere = initLayerSphere(document.getElementById('layerSphere'));

    var SLIDES = LAYER_SLIDES.length;
    var current = -1;

    function render(i) {
      var slide = LAYER_SLIDES[i];

      if (badge) badge.classList.toggle('is-visible', !slide.intro);
      if (badgeText) badgeText.textContent = slide.badge;
      if (tagline) tagline.textContent = slide.tagline;
      heading.textContent = slide.heading;
      desc.textContent = slide.desc;
      if (link) {
        link.href = slide.href;
        link.textContent = slide.linkText;
        link.classList.toggle('is-visible', !slide.intro);
      }
      if (progressRow) progressRow.classList.toggle('is-visible', !slide.intro);
      progressSegs.forEach(function (seg, idx) {
        seg.classList.toggle('is-done', !slide.intro && idx < slide.node + 1);
      });
      if (scrollHint) scrollHint.classList.toggle('is-visible', slide.intro);
      if (sphere) sphere.setActive(slide.node);
    }

    function slideIndexFromScroll() {
      var rect = container.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      if (total <= 0) return 0;
      var scrolled = Math.min(total, Math.max(0, -rect.top));
      var progress = scrolled / total;
      return Math.min(SLIDES - 1, Math.floor(progress * SLIDES));
    }

    function onScroll() {
      var idx = slideIndexFromScroll();
      if (idx !== current) {
        current = idx;
        render(idx);
      }
    }

    function goToSlide(i) {
      i = Math.max(0, Math.min(SLIDES - 1, i));
      var rect = container.getBoundingClientRect();
      var sectionTop = window.scrollY + rect.top;
      var total = container.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      var target = sectionTop + (i / SLIDES) * total + 20;
      window.scrollTo({ top: target, behavior: prefersReduced ? 'auto' : 'smooth' });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goToSlide(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goToSlide(current + 1); });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    render(0);
    onScroll();
  }

  /* ── Label page: AI Engines scroll-driven sphere ──
     Same .layer-scroll/.layer-sticky mechanics as the platform page's Five
     Layers section (see initLayerScroll above), reused for a 5-slide
     sequence: an intro slide, then Text / Image·Vision / Video / Audio.
     The canvas starts as a "basketball" — 4 great-circle rings at different
     tilts, tumbling — matching the sphere-with-4-rings intro state on the
     platform page's spirit. Ring 0 is special: as soon as any engine slide
     activates, it morphs (linear blend, not physically exact but safe and
     visually a clean "unfurl") from its tilted orientation into a flat
     disc facing the viewer, while rings 1-3 fade out. Once flattened, ring
     0 stops tumbling with the scene (its own rotation contribution eases
     to zero) and instead the task-name chips positioned around its
     circumference orbit independently — that's the "rotating round in
     circle" motion — so labels stay flat and legible instead of tumbling
     edge-on. Switching engines swaps the chip set with a quick crossfade;
     it does not re-collapse back into the 3D sphere (only the intro slide
     does that). All bounds verified numerically before shipping — see the
     scratch harness this was built against. */
  var ENGINE_SLIDES = [
    { intro: true, tagline: 'AI Engine', heading: 'The AI Engines', desc: 'Four specialised modality families routing each item to the right kind of intelligence labelling engine text, vision, video, and audio, each producing its own labelling confidence score.', tasks: [] },
    { intro: false, tagline: 'AI Engine', heading: 'Text', desc: 'Advanced NLP understanding optimized for complex labelling tasks performing entity recognition, preference ranking, document summarization, question answering, and relational mapping.', tasks: ['RLHF Preference', 'Named Entity Recognition', 'Classification', 'Summarisation', 'Extractive QA', 'Relation Extraction'] },
    { intro: false, tagline: 'AI Engine', heading: 'Image / Vision', desc: 'Spatial object detection and multi-class recognition paired with pixel-exact segmentation masks, followed by high-density landmark mapping, along with isolating facial, structural, and anatomical pose features with geometric precision.', tasks: ['Classification', 'Object Detection', 'Instance Segmentation', 'Semantic Segmentation', 'Keypoint Estimation', 'Image Captioning', 'OCR'] },
    { intro: false, tagline: 'AI Engine', heading: 'Video', desc: 'High-resolution frame extraction combined with motion tracking and temporal segmentation with pixel-level instance masks are persistently tracked across consecutive frames to maintain complete target continuity.', tasks: ['Classification', 'Object Tracking', 'Instance Segmentation', 'Temporal Segmentation', 'Per-Frame Annotation', 'Pose Tracking'] },
    { intro: false, tagline: 'AI Engine', heading: 'Audio', desc: 'Precise, word-level speech transcription with exact timestamps along with advanced acoustic analysis decoding speaker diarization, emotional registery, dynamic tones, and subtle background event sounds.', tasks: ['Transcription', 'Speaker Diarisation', 'Sound Event Detection', 'Classification', 'Emotion Detection', 'Audio Segmentation'] }
  ];

  function initEngineSphere(canvas) {
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H;
    function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
    resize();
    window.addEventListener('resize', resize);

    var TILTS = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
    var SEG = 64;

    function lerp(a, b, t) { return a + (b - a) * t; }
    function tiltedPoint(theta, phi) {
      return { x: Math.cos(theta) * Math.cos(phi), y: Math.cos(theta) * Math.sin(phi), z: Math.sin(theta) };
    }
    function flatPoint(theta, radiusMul) {
      return { x: Math.cos(theta) * radiusMul, y: Math.sin(theta) * radiusMul, z: 0 };
    }
    function blendedRing0(theta, flatten, radiusMul) {
      var t = tiltedPoint(theta, TILTS[0]);
      var f = flatPoint(theta, radiusMul);
      return { x: lerp(t.x, f.x, flatten), y: lerp(t.y, f.y, flatten), z: lerp(t.z, f.z, flatten) };
    }
    function rotateY(p, rotY) {
      var cosR = Math.cos(rotY), sinR = Math.sin(rotY);
      return { x: p.x * cosR + p.z * sinR, y: p.y, z: p.z * cosR - p.x * sinR };
    }
    function project(p, cx, cy, R) {
      return { x: cx + p.x * R, y: cy - p.y * R, depth: p.z };
    }

    var sceneRotY = 0;
    var flatten = 0, targetFlatten = 0;
    var taskAlpha = 0, targetTaskAlpha = 0;
    var orbitAngle = 0;
    var activeIndex = -1;
    var currentTasks = [];

    function drawRing(pts, rgb, alpha) {
      if (alpha <= 0.01) return;
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(2) + ')';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H / 2;
      var R = Math.min(W, H) * 0.24;
      var ring0RotY = sceneRotY * (1 - flatten);

      for (var r = 1; r <= 3; r++) {
        var fade = (1 - flatten) * 0.5;
        var pts = [];
        for (var s = 0; s <= SEG; s++) {
          var theta = (s / SEG) * Math.PI * 2;
          pts.push(project(rotateY(tiltedPoint(theta, TILTS[r]), sceneRotY), cx, cy, R));
        }
        drawRing(pts, rgb, fade);
      }

      var pts0 = [];
      for (var s0 = 0; s0 <= SEG; s0++) {
        var theta0 = (s0 / SEG) * Math.PI * 2;
        pts0.push(project(rotateY(blendedRing0(theta0, flatten, 1), ring0RotY), cx, cy, R));
      }
      drawRing(pts0, rgb, 0.35 + flatten * 0.25);

      if (taskAlpha > 0.01 && currentTasks.length) {
        var n = currentTasks.length;
        for (var i = 0; i < n; i++) {
          var theta1 = ((2 * Math.PI) / n) * i + orbitAngle;
          var lp = project(rotateY(blendedRing0(theta1, flatten, 1.1), ring0RotY), cx, cy, R);
          var label = currentTasks[i];
          ctx.font = "600 10px 'Inter', sans-serif";
          var textW = ctx.measureText(label).width;
          var padX = 10, padY = 7;
          var boxW = textW + padX * 2, boxH = 14 + padY;
          var bx = lp.x - boxW / 2, by = lp.y - boxH / 2;
          ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (taskAlpha * 0.06).toFixed(2) + ')';
          ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (taskAlpha * 0.35).toFixed(2) + ')';
          ctx.lineWidth = 1;
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 7); ctx.fill(); ctx.stroke(); }
          else { ctx.fillRect(bx, by, boxW, boxH); ctx.strokeRect(bx, by, boxW, boxH); }
          ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + taskAlpha.toFixed(2) + ')';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, lp.x, by + boxH / 2 + 1);
        }
      }
    }

    function tick() {
      requestAnimationFrame(tick);
      if (!prefersReduced) {
        sceneRotY += 0.0032;
        orbitAngle += 0.0055;
      }
      var fDiff = targetFlatten - flatten;
      flatten += fDiff * (prefersReduced ? 1 : 0.06);
      var aDiff = targetTaskAlpha - taskAlpha;
      taskAlpha += aDiff * (prefersReduced ? 1 : 0.12);
      draw();
    }
    tick();

    return {
      setActive: function (index, tasks) {
        if (index !== activeIndex) {
          taskAlpha = 0;
          currentTasks = tasks || [];
        }
        activeIndex = index;
        targetFlatten = index >= 0 ? 1 : 0;
        targetTaskAlpha = index >= 0 ? 1 : 0;
      }
    };
  }

  function initEngineScroll() {
    var container = document.getElementById('engineScroll');
    if (!container || window.innerWidth < 900) return;

    var tagline = document.getElementById('engineTagline');
    var heading = document.getElementById('engineHeading');
    var desc = document.getElementById('engineDesc');
    var progressRow = document.getElementById('engineProgressRow');
    var progressSegs = progressRow ? progressRow.querySelectorAll('.layer-progress-seg') : [];
    var scrollHint = document.getElementById('engineScrollHint');
    var prevBtn = container.querySelector('.engine-prev');
    var nextBtn = container.querySelector('.engine-next');
    if (!heading || !desc) return;

    var sphere = initEngineSphere(document.getElementById('engineSphere'));

    var SLIDES = ENGINE_SLIDES.length;
    var current = -1;

    function render(i) {
      var slide = ENGINE_SLIDES[i];
      if (tagline) tagline.textContent = slide.tagline;
      heading.textContent = slide.heading;
      desc.textContent = slide.desc;
      if (progressRow) progressRow.classList.toggle('is-visible', !slide.intro);
      progressSegs.forEach(function (seg, idx) {
        seg.classList.toggle('is-done', !slide.intro && idx < i);
      });
      if (scrollHint) scrollHint.classList.toggle('is-visible', slide.intro);
      if (sphere) sphere.setActive(slide.intro ? -1 : i - 1, slide.tasks);
    }

    function slideIndexFromScroll() {
      var rect = container.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      if (total <= 0) return 0;
      var scrolled = Math.min(total, Math.max(0, -rect.top));
      var progress = scrolled / total;
      return Math.min(SLIDES - 1, Math.floor(progress * SLIDES));
    }

    function onScroll() {
      var idx = slideIndexFromScroll();
      if (idx !== current) { current = idx; render(idx); }
    }

    function goToSlide(i) {
      i = Math.max(0, Math.min(SLIDES - 1, i));
      var rect = container.getBoundingClientRect();
      var sectionTop = window.scrollY + rect.top;
      var total = container.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      var target = sectionTop + (i / SLIDES) * total + 20;
      window.scrollTo({ top: target, behavior: prefersReduced ? 'auto' : 'smooth' });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goToSlide(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goToSlide(current + 1); });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    render(0);
    onScroll();
  }

  /* ── Govern page: scroll-driven pixel-dot cube ──
     Same .layer-scroll/.layer-sticky mechanics as the Label page's AI
     Engines section (see initEngineScroll above), reused for a 7-slide
     sequence: an intro slide, then the 6 governance controls. The canvas
     is a wireframe cube built from a "pixel" dot grid on each face (plus
     faint edge lines), continuously tumbling across all three axes. Each
     point's final position is a per-point linear blend (not an angle
     blend, so there's no wraparound/gimbal risk — the same technique the
     AI Engines sphere uses for its ring0 "unfurl") between its freely
     tumbling position and its position under a fixed target rotation that
     brings one face square onto the viewer. On the intro slide the blend
     stays at 0 (pure free tumble, no face highlighted). Scrolling into a
     control slide eases the blend to 1, so the cube "revolves and stops"
     with that control's face centered and its heading faded in beside it;
     scrolling back out eases the blend back to 0 and the tumble resumes
     from wherever it currently is (no jump, since the free rotation never
     stops accumulating in the background). Rotation/projection formulas
     and full-cycle bounds (all 8 corners + every face's dot grid, across
     the intro tumble, every settled face, and the transitions between)
     verified numerically before shipping — see the scratch harness this
     was built against. */
  var GOVERN_SLIDES = [
    { intro: true, tagline: 'Governance', heading: 'Six Controls, Continuous Governance', desc: 'Six automated controls run on every dataset, on every layer, every time — provenance, logging, lineage, integrity, quality, and access, with no manual audit required.', face: null },
    { intro: false, tagline: 'Governance Control', heading: 'Provenance Tracking', desc: 'Every dataset records its origin — storage backend, file, query, or upload — and that provenance persists through every operation into the final lineage report.', face: '+Z' },
    { intro: false, tagline: 'Governance Control', heading: 'Operation Logging', desc: 'Every transformation, labeling decision, review, and export is logged as an immutable, timestamped event tied to its actor — AI engine or human reviewer.', face: '+X' },
    { intro: false, tagline: 'Governance Control', heading: 'Lineage Reports', desc: 'Every version auto-generates a structured lineage document — identity, provenance, transformations, and risk — included with every export.', face: '-Z' },
    { intro: false, tagline: 'Governance Control', heading: 'Version Integrity', desc: 'Every frozen version is SHA-256 hash-verified across data, labels, and metadata — cryptographic proof the export matches what was approved.', face: '-X' },
    { intro: false, tagline: 'Governance Control', heading: 'Quality Gates', desc: 'Datasets must clear configurable thresholds — agreement rate, error rate, class balance — before export. Failing versions are flagged with blocking issues.', face: '+Y' },
    { intro: false, tagline: 'Governance Control', heading: 'Access Control', desc: 'Role-based permissions scope every dataset, connection, and operation — annotators see only their tasks, teams see only their own data.', face: '-Y' }
  ];

  var GOVERN_FACE_TARGET = {
    '+Z': { rx: 0, ry: 0 },
    '-Z': { rx: 0, ry: Math.PI },
    '+X': { rx: 0, ry: -Math.PI / 2 },
    '-X': { rx: 0, ry: Math.PI / 2 },
    '+Y': { rx: Math.PI / 2, ry: 0 },
    '-Y': { rx: -Math.PI / 2, ry: 0 }
  };

  function initGovernCube(canvas) {
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H;
    function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
    resize();
    window.addEventListener('resize', resize);

    function rotateX(p, a) { var c = Math.cos(a), s = Math.sin(a); return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }; }
    function rotateY(p, a) { var c = Math.cos(a), s = Math.sin(a); return { x: p.x * c + p.z * s, y: p.y, z: p.z * c - p.x * s }; }
    function rotateZ(p, a) { var c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }; }
    function applyFree(p) { return rotateZ(rotateY(rotateX(p, freeRotX), freeRotY), freeRotZ); }
    function applyTarget(p, t) { return rotateY(rotateX(p, t.rx), t.ry); }
    function lerp3(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }; }
    function project(p, cx, cy, R) { return { x: cx + p.x * R, y: cy - p.y * R, depth: p.z }; }
    function depthAlpha(depth, mul) { return (0.14 + Math.max(0, (depth / 1.8 + 1) / 2) * 0.55) * mul; }

    var CORNERS = [];
    [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) {
      CORNERS.push({ x: x, y: y, z: z });
    }); }); });
    var EDGES = [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]];

    var G = 4, INSET = 0.78;
    var FACE_DEFS = [
      { name: '+Z', normal: { x: 0, y: 0, z: 1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
      { name: '-Z', normal: { x: 0, y: 0, z: -1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
      { name: '+X', normal: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 1, z: 0 }, v: { x: 0, y: 0, z: 1 } },
      { name: '-X', normal: { x: -1, y: 0, z: 0 }, u: { x: 0, y: 1, z: 0 }, v: { x: 0, y: 0, z: 1 } },
      { name: '+Y', normal: { x: 0, y: 1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } },
      { name: '-Y', normal: { x: 0, y: -1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } }
    ];
    var DOTS = [];
    FACE_DEFS.forEach(function (f) {
      for (var i = 0; i < G; i++) {
        for (var j = 0; j < G; j++) {
          var s = (i / (G - 1)) * 2 - 1, t = (j / (G - 1)) * 2 - 1;
          DOTS.push({
            x: f.normal.x + f.u.x * s * INSET + f.v.x * t * INSET,
            y: f.normal.y + f.u.y * s * INSET + f.v.y * t * INSET,
            z: f.normal.z + f.u.z * s * INSET + f.v.z * t * INSET,
            face: f.name
          });
        }
      }
    });

    var freeRotX = 0.4, freeRotY = 0.7, freeRotZ = 0;
    var settle = 0, targetSettle = 0;
    var labelAlpha = 0, targetLabelAlpha = 0;
    var activeFace = null, activeLabel = '';
    var pendingFace = null, pendingLabel = '', hasPending = false;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H / 2;
      var R = Math.min(W, H) * 0.19;
      var target = activeFace ? GOVERN_FACE_TARGET[activeFace] : null;

      function finalOf(raw) {
        var freeP = applyFree(raw);
        if (!target) return freeP;
        return lerp3(freeP, applyTarget(raw, target), settle);
      }

      var cornerProj = CORNERS.map(function (c) { return project(finalOf(c), cx, cy, R); });

      EDGES.forEach(function (e) {
        var a = cornerProj[e[0]], b = cornerProj[e[1]];
        var avgDepth = (a.depth + b.depth) / 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + depthAlpha(avgDepth, 0.5).toFixed(2) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      var dotProj = DOTS.map(function (d) {
        var p = finalOf(d);
        var proj = project(p, cx, cy, R);
        proj.face = d.face;
        return proj;
      });
      dotProj.sort(function (a, b) { return a.depth - b.depth; });
      dotProj.forEach(function (p) {
        var isActive = p.face === activeFace;
        var boost = isActive ? settle : 0;
        var radius = 1.5 + boost * 1.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + depthAlpha(p.depth, 1 + boost * 0.6).toFixed(2) + ')';
        ctx.fill();
      });

      if (labelAlpha > 0.01 && activeFace) {
        var facedef = FACE_DEFS.filter(function (f) { return f.name === activeFace; })[0];
        var centerP = finalOf(facedef.normal);
        var lp = project(centerP, cx, cy, R);
        ctx.font = "600 15px 'Inter', sans-serif";
        var textW = ctx.measureText(activeLabel).width;
        var padX = 14, padY = 9;
        var boxW = textW + padX * 2, boxH = 17 + padY;
        var bx = lp.x - boxW / 2, by = lp.y - boxH / 2;
        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (labelAlpha * 0.08).toFixed(2) + ')';
        ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (labelAlpha * 0.4).toFixed(2) + ')';
        ctx.lineWidth = 1;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 8); ctx.fill(); ctx.stroke(); }
        else { ctx.fillRect(bx, by, boxW, boxH); ctx.strokeRect(bx, by, boxW, boxH); }
        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + labelAlpha.toFixed(2) + ')';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeLabel, lp.x, by + boxH / 2 + 1);
      }
    }

    function tick() {
      requestAnimationFrame(tick);
      if (!prefersReduced) {
        freeRotX += 0.0031;
        freeRotY += 0.0047;
        freeRotZ += 0.0013;
      }
      var sDiff = targetSettle - settle;
      settle += sDiff * (prefersReduced ? 1 : 0.055);
      var lDiff = targetLabelAlpha - labelAlpha;
      labelAlpha += lDiff * (prefersReduced ? 1 : 0.11);
      /* Two-phase transition: a change of target face first eases settle
         back toward 0 (un-freezing into the free tumble, "showing the
         other surfaces") before the new face is committed and eased back
         up to 1 ("stops" on it) — see setActive below. Without this, a
         same-tick swap of activeFace would just relabel the already-
         settled cube instead of visibly revolving to the new face. */
      if (hasPending && (settle < 0.02 || prefersReduced)) {
        activeFace = pendingFace;
        activeLabel = pendingLabel;
        hasPending = false;
        targetSettle = activeFace ? 1 : 0;
        targetLabelAlpha = activeFace ? 1 : 0;
      }
      draw();
    }
    tick();

    return {
      setActive: function (face, label) {
        if (hasPending ? face === pendingFace : face === activeFace) return;
        pendingFace = face;
        pendingLabel = label || '';
        hasPending = true;
        targetSettle = 0;
        targetLabelAlpha = 0;
      }
    };
  }

  function initGovernScroll() {
    var container = document.getElementById('governScroll');
    if (!container || window.innerWidth < 900) return;

    var tagline = document.getElementById('governTagline');
    var heading = document.getElementById('governHeading');
    var desc = document.getElementById('governDesc');
    var progressRow = document.getElementById('governProgressRow');
    var progressSegs = progressRow ? progressRow.querySelectorAll('.layer-progress-seg') : [];
    var scrollHint = document.getElementById('governScrollHint');
    var prevBtn = container.querySelector('.govern-prev');
    var nextBtn = container.querySelector('.govern-next');
    if (!heading || !desc) return;

    var cube = initGovernCube(document.getElementById('governCube'));

    var SLIDES = GOVERN_SLIDES.length;
    var current = -1;

    function render(i) {
      var slide = GOVERN_SLIDES[i];
      if (tagline) tagline.textContent = slide.tagline;
      heading.textContent = slide.heading;
      desc.textContent = slide.desc;
      if (progressRow) progressRow.classList.toggle('is-visible', !slide.intro);
      progressSegs.forEach(function (seg, idx) {
        seg.classList.toggle('is-done', !slide.intro && idx < i);
      });
      if (scrollHint) scrollHint.classList.toggle('is-visible', slide.intro);
      if (cube) cube.setActive(slide.face, slide.heading);
    }

    function slideIndexFromScroll() {
      var rect = container.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      if (total <= 0) return 0;
      var scrolled = Math.min(total, Math.max(0, -rect.top));
      var progress = scrolled / total;
      return Math.min(SLIDES - 1, Math.floor(progress * SLIDES));
    }

    function onScroll() {
      var idx = slideIndexFromScroll();
      if (idx !== current) { current = idx; render(idx); }
    }

    function goToSlide(i) {
      i = Math.max(0, Math.min(SLIDES - 1, i));
      var rect = container.getBoundingClientRect();
      var sectionTop = window.scrollY + rect.top;
      var total = container.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      var target = sectionTop + (i / SLIDES) * total + 20;
      window.scrollTo({ top: target, behavior: prefersReduced ? 'auto' : 'smooth' });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goToSlide(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goToSlide(current + 1); });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    render(0);
    onScroll();
  }

  /* ── Why Datalier: rotating wireframe "packet" ──
     A closed, compact box: a wavy top surface (the same combined-sine
     terrain technique proven earlier in this file) bounded by a
     rectangular footprint, with vertical wall lines dropping from the
     surface's edge down to a flat base and a base outline closing it off
     — so it reads as one contained solid object, not an open/unbounded
     plane. Continuously rotating. Perspective denominator verified
     numerically to stay well clear of zero (see project() comment). */
  function initPacketWireframe(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H;
    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    var ROWS = 34, COLS = 46, WALL_LINES = 13;
    var HX = 1, HZ = 0.56, BASE_Y = -0.34, TOP_BASE = 0.08;

    function waveY(colT, rowT, t) {
      return TOP_BASE + (
        Math.sin(colT * 3.1 + rowT * 1.6 + t * 0.012) * 0.5 +
        Math.sin(colT * 1.6 - rowT * 2.4 + t * 0.017) * 0.3 +
        Math.sin(rowT * 3.6 - t * 0.01) * 0.2
      ) * 0.3;
    }
    function topPoint(colT, rowT, t) {
      return { x: colT * HX, y: waveY(colT, rowT, t), z: rowT * HZ };
    }

    /* Numerically verified across a full rotation + the whole surface,
       wall, and base grid: |zr| tops out around 1.15, so 1 - zr*0.35
       stays within roughly [0.6, 1.4] — always comfortably positive. */
    function project(p, cosR, sinR, cx, cy, scale) {
      var xr = p.x * cosR + p.z * sinR;
      var zr = p.z * cosR - p.x * sinR;
      var persp = 1 / (1 - zr * 0.35);
      return { x: cx + xr * scale * persp, y: cy - p.y * scale * persp, depth: zr };
    }

    function strokeLine(pts, rgb, fadeMul) {
      var sumDepth = 0;
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        sumDepth += pts[i].depth;
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      var avgDepth = sumDepth / pts.length;
      var alpha = (0.08 + Math.max(0, (avgDepth + 1) / 2) * 0.55) * (fadeMul || 1);
      ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function draw(rotY, t) {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H * 0.5;
      var scale = Math.min(W, H) * 0.48;
      var cosR = Math.cos(rotY), sinR = Math.sin(rotY);

      /* top surface — rows of wavy lines */
      for (var r = 0; r <= ROWS; r++) {
        var rowT = (r / ROWS) * 2 - 1;
        var pts = [];
        for (var c = 0; c <= COLS; c++) {
          var colT = (c / COLS) * 2 - 1;
          pts.push(project(topPoint(colT, rowT, t), cosR, sinR, cx, cy, scale));
        }
        strokeLine(pts, rgb, 1);
      }
      /* left/right boundary curves, closing the top surface's outline */
      [-1, 1].forEach(function (colT) {
        var pts = [];
        for (var s = 0; s <= COLS; s++) {
          var rowT = (s / COLS) * 2 - 1;
          pts.push(project(topPoint(colT, rowT, t), cosR, sinR, cx, cy, scale));
        }
        strokeLine(pts, rgb, 1);
      });
      /* walls — vertical drop lines around the perimeter, from the top
         surface's edge down to the base */
      for (var i = 0; i <= WALL_LINES; i++) {
        var tt = (i / WALL_LINES) * 2 - 1;
        [topPoint(tt, -1, t), topPoint(tt, 1, t), topPoint(-1, tt, t), topPoint(1, tt, t)].forEach(function (p) {
          var top = project(p, cosR, sinR, cx, cy, scale);
          var bottom = project({ x: p.x, y: BASE_Y, z: p.z }, cosR, sinR, cx, cy, scale);
          strokeLine([top, bottom], rgb, 0.8);
        });
      }
      /* base outline */
      var baseCorners = [
        { x: -HX, y: BASE_Y, z: -HZ }, { x: HX, y: BASE_Y, z: -HZ },
        { x: HX, y: BASE_Y, z: HZ }, { x: -HX, y: BASE_Y, z: HZ }, { x: -HX, y: BASE_Y, z: -HZ }
      ];
      strokeLine(baseCorners.map(function (p) { return project(p, cosR, sinR, cx, cy, scale); }), rgb, 0.9);
    }

    if (prefersReduced) {
      draw(0.6, 0);
      document.addEventListener('concave:themechange', function () { draw(0.6, 0); });
      return;
    }

    var rotY = 0, t = 0;
    function tick() {
      requestAnimationFrame(tick);
      rotY += 0.005;
      t++;
      draw(rotY, t);
    }
    tick();
  }

  /* ── Observe page: rotating infinity-symbol wireframe ──
     A tube swept along a lemniscate-of-Gerono centerline (cx=cos(t),
     cy=sin(t)cos(t)) standing upright in the XY plane, cross-section frame
     built from a fixed "forward" (0,0,1) reference — safe because the
     centerline's tangent always lies flat in the XY plane, so it's never
     parallel to that reference (no degenerate/gimbal case to reason
     about). Depth comes from the tube's own thickness (its Z axis).

     Two layers of motion, both verified numerically before shipping
     (bounded projection, no NaN, across a full simulated cycle):

     1. A continuous tumble — three rotation axes (X/Y/Z), each with its
        own base rate PLUS a slow sine-drifting component at a different
        frequency/phase, so the combined motion keeps changing character
        instead of repeating a fixed single-axis spin.

     2. A slower phase cycle (~13s) layered on top: tumble as one whole
        shape → split into its two natural lobes (a lemniscate is already
        two loops joined at the crossing point — pulling them apart via a
        screen-space horizontal offset needs no new geometry) → each lobe
        gets its own additional divergence rotation (different frequency
        each, so they read as independently tumbling) while separated →
        ease back together and rejoin. Longitude lines are drawn as two
        half-lobe segments (not one continuous line through the crossing
        point) specifically so they can visually separate cleanly. */
  function initInfinityWireframe(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H;
    function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
    resize();
    window.addEventListener('resize', resize);

    var R = 0.16;
    var LON_LINES = 16, LAT_LINES = 45, THETA_SEG = 20, LOBE_SEG = 40;
    var K = 0.35;
    var T_TUMBLE = 18, T_TO_SPLIT = 2, T_SPLIT = 20, T_TO_JOIN = 2;
    var CYCLE = T_TUMBLE + T_TO_SPLIT + T_SPLIT + T_TO_JOIN;

    function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

    function tubePoint(t, theta) {
      var cx = Math.cos(t);
      var cy = Math.sin(t) * Math.cos(t);
      var Tx = -Math.sin(t);
      var Ty = Math.cos(2 * t);
      var Tlen = Math.sqrt(Tx * Tx + Ty * Ty);
      var Nx = Ty / Tlen, Ny = -Tx / Tlen;
      return {
        x: cx + R * Math.cos(theta) * Nx,
        y: cy + R * Math.cos(theta) * Ny,
        z: R * Math.sin(theta)
      };
    }

    function rotateX(p, a) { var c = Math.cos(a), s = Math.sin(a); return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }; }
    function rotateY(p, a) { var c = Math.cos(a), s = Math.sin(a); return { x: p.x * c + p.z * s, y: p.y, z: p.z * c - p.x * s }; }
    function rotateZ(p, a) { var c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }; }

    function project(p, cx, cy, scale) {
      var persp = 1 / (1 - p.z * K);
      return { x: cx + p.x * scale * persp, y: cy - p.y * scale * persp, depth: p.z };
    }

    function strokeLine(pts, rgb) {
      var sumDepth = 0;
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        sumDepth += pts[i].depth;
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      var avgDepth = sumDepth / pts.length;
      var alpha = 0.1 + Math.max(0, (avgDepth / 1.3 + 1) / 2) * 0.55;
      ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function splitFactorAt(timeInCycle) {
      var tc = timeInCycle;
      if (tc < T_TUMBLE) return 0;
      tc -= T_TUMBLE;
      if (tc < T_TO_SPLIT) return smooth(tc / T_TO_SPLIT);
      tc -= T_TO_SPLIT;
      if (tc < T_SPLIT) return 1;
      tc -= T_SPLIT;
      return 1 - smooth(tc / T_TO_JOIN);
    }

    function draw(rotX, rotY, rotZ, timeSec, driftTime) {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H / 2;
      var baseScale = Math.min(W, H) * 0.295;

      var timeInCycle = timeSec % CYCLE;
      var sf = splitFactorAt(timeInCycle);
      var sepPx = baseScale * 0.62 * sf;
      var wanderR = sf * baseScale * 0.2 * Math.sin(driftTime * 0.12 + 0.5);
      var wanderL = sf * baseScale * 0.2 * Math.sin(driftTime * 0.1 + 2);
      var divR = sf * 0.9 * Math.sin(driftTime * 0.9 + 0.4);
      var divL = sf * 0.9 * Math.sin(driftTime * 0.6 + 2.1);

      function lobePoint(t, theta, isRight) {
        var p = tubePoint(t, theta);
        var div = isRight ? divR : divL;
        p = rotateX(p, rotX + div);
        p = rotateY(p, rotY + div * 0.7);
        p = rotateZ(p, rotZ);
        var proj = project(p, cx, cy, baseScale);
        proj.x += isRight ? (sepPx + wanderR) : (-sepPx + wanderL);
        return proj;
      }

      for (var j = 0; j < LON_LINES; j++) {
        var theta = (j / LON_LINES) * Math.PI * 2;
        var ptsR = [], ptsL = [];
        for (var s = 0; s <= LOBE_SEG; s++) {
          var tr = -Math.PI / 2 + (s / LOBE_SEG) * Math.PI;
          ptsR.push(lobePoint(tr, theta, true));
          var tl = Math.PI / 2 + (s / LOBE_SEG) * Math.PI;
          ptsL.push(lobePoint(tl, theta, false));
        }
        strokeLine(ptsR, rgb);
        strokeLine(ptsL, rgb);
      }
      for (var i = 0; i <= LAT_LINES; i++) {
        var t2 = (i / LAT_LINES) * Math.PI * 2;
        var isRight2 = Math.cos(t2) >= 0;
        var pts2 = [];
        for (var s2 = 0; s2 <= THETA_SEG; s2++) {
          var theta2 = (s2 / THETA_SEG) * Math.PI * 2;
          pts2.push(lobePoint(t2, theta2, isRight2));
        }
        strokeLine(pts2, rgb);
      }
    }

    if (prefersReduced) {
      draw(0, 0.5, 0, 0, 0);
      document.addEventListener('concave:themechange', function () { draw(0, 0.5, 0, 0, 0); });
      return;
    }

    var rotX = 0, rotY = 0, rotZ = 0, frame = 0;
    function tick() {
      requestAnimationFrame(tick);
      frame++;
      var driftTime = frame * 0.001;
      rotX += 0.003 + 0.0025 * Math.sin(driftTime * 0.31);
      rotY += 0.004 + 0.003 * Math.sin(driftTime * 0.23 + 1.7);
      rotZ += 0.002 + 0.0018 * Math.sin(driftTime * 0.17 + 3.1);
      draw(rotX, rotY, rotZ, frame / 60, driftTime);
    }
    tick();
  }

  /* ── Platform Overview — scroll-driven, modeled directly on
     initLayerScroll above: .ovScroll is a tall container, .ov-sticky pins
     to the viewport while it scrolls past, and scroll position within the
     container maps to a continuous 0..STAGES-1 progress value.
     Two things ride on that one progress value:
       - the three headings' active/dim state (discrete — snaps at each
         stage boundary, same as Five Layers' badge/heading swap)
       - the image reel's vertical offset (continuous — interpolated
         between each stage's target position, so the reel visibly flows
         rather than jumping), plus a per-group opacity fade keyed off
         distance from the current progress so the active stage's images
         stay full-strength while neighbouring stages fade like they're
         peeking in/out of frame.
     Desktop only (≥900px) — .ov-mobile below is the stacked-list
     fallback, same convention as .layer-mobile. */
  function initOverviewScroll() {
    var container = document.getElementById('ovScroll');
    if (!container || window.innerWidth < 900) return;

    var headingItems = container.querySelectorAll('.ov-heading-item');
    var groups = container.querySelectorAll('.ov-group');
    var visual = document.getElementById('ovVisual');
    var track = document.getElementById('ovTrack');
    if (!headingItems.length || !groups.length || !visual || !track) return;

    var STAGES = headingItems.length;
    var current = -1;
    var offsets = [];

    function measure() {
      offsets = Array.prototype.map.call(groups, function (g) {
        return g.offsetTop + g.offsetHeight / 2;
      });
    }

    function render(index) {
      headingItems.forEach(function (h, i) { h.classList.toggle('is-active', i === index); });
    }

    function applyTrack(progress) {
      var lo = Math.max(0, Math.min(STAGES - 1, Math.floor(progress)));
      var hi = Math.min(STAGES - 1, lo + 1);
      var blend = progress - lo;
      var target = offsets[lo] + (offsets[hi] - offsets[lo]) * blend;
      var y = visual.clientHeight / 2 - target;
      track.style.transform = 'translateY(' + y + 'px)';

      groups.forEach(function (g, i) {
        var dist = Math.abs(i - progress);
        g.style.opacity = Math.max(0.18, 1 - dist * 0.75);
      });
    }

    function scrollProgress() {
      var rect = container.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      if (total <= 0) return 0;
      var scrolled = Math.min(total, Math.max(0, -rect.top));
      return (scrolled / total) * (STAGES - 1);
    }

    function onScroll() {
      var progress = scrollProgress();
      applyTrack(progress);
      var discrete = Math.max(0, Math.min(STAGES - 1, Math.round(progress)));
      if (discrete !== current) {
        current = discrete;
        render(discrete);
      }
    }

    function goToStage(i) {
      i = Math.max(0, Math.min(STAGES - 1, i));
      var rect = container.getBoundingClientRect();
      var sectionTop = window.scrollY + rect.top;
      var total = container.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      var target = sectionTop + (i / (STAGES - 1)) * total + 10;
      window.scrollTo({ top: target, behavior: prefersReduced ? 'auto' : 'smooth' });
    }

    headingItems.forEach(function (h, i) {
      h.addEventListener('click', function () { goToStage(i); });
    });

    window.addEventListener('resize', function () { measure(); onScroll(); }, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    measure();
    render(0);
    onScroll();
  }

  /* ── Task switcher (modality pages) — a vertical list of task names next
     to a stack of placeholder media panels. Hovering or clicking a task
     activates it (and only it) by matching list index to panel index, so
     any page can drop in a differently-sized list/panel set and it just
     works. No revert-on-leave, unlike the who-blocks accordion — this is
     a persistent selection, not a hover preview. */
  function initTaskSwitch() {
    var AUTO_MS = 15000;
    var groups = document.querySelectorAll('.task-switch');
    groups.forEach(function (group) {
      var items = group.querySelectorAll('.task-switch-item');
      var media = group.querySelectorAll('.task-switch-media-item');
      if (!items.length || items.length !== media.length) return;

      var current = 0;
      items.forEach(function (item, i) { if (item.classList.contains('is-active')) current = i; });

      function activate(index) {
        current = index;
        items.forEach(function (item, i) { item.classList.toggle('is-active', i === index); });
        media.forEach(function (m, i) { m.classList.toggle('is-active', i === index); });
      }

      var timer;
      function startAuto() {
        clearInterval(timer);
        timer = setInterval(function () { activate((current + 1) % items.length); }, AUTO_MS);
      }

      /* Click only — hovering a long vertical list while scrolling past
         shouldn't hijack the panel. A click is a deliberate pick, and it
         restarts the 15s cycle from there rather than fighting it. */
      items.forEach(function (item, i) {
        item.addEventListener('click', function () {
          activate(i);
          startAuto();
        });
      });

      if (!prefersReduced) startAuto();
    });
  }

  /* ── FAQ accordion — single item open at a time. ── */
  function initFaq() {
    var items = document.querySelectorAll('.faq-item');
    if (!items.length) return;
    items.forEach(function (item) {
      var btn = item.querySelector('.faq-question');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var wasOpen = item.classList.contains('is-open');
        items.forEach(function (i) { i.classList.remove('is-open'); });
        if (!wasOpen) item.classList.add('is-open');
      });
    });
  }

  function init() {
    initLayerScroll();
    initEngineScroll();
    initGovernScroll();
    initPacketWireframe(document.getElementById('bestCanvas'));
    initInfinityWireframe(document.getElementById('infinityCanvas'));
    initOverviewScroll();
    initTaskSwitch();
    initFaq();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
