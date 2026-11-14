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
    { intro: true, tagline: 'AI Engine', heading: 'The AI Engines', desc: 'Five specialised modality families routing each item to the right kind of intelligence labelling engine text, vision, video, audio, and 3D / LiDAR, each producing its own labelling confidence score.', tasks: [] },
    { intro: false, tagline: 'AI Engine', heading: 'Text', desc: 'Advanced NLP understanding optimized for complex labelling tasks performing entity recognition, preference ranking, document summarization, question answering, and relational mapping.', tasks: ['RLHF Preference', 'Named Entity Recognition', 'Classification', 'Summarisation', 'Extractive QA', 'Relation Extraction'] },
    { intro: false, tagline: 'AI Engine', heading: 'Image / Vision', desc: 'Spatial object detection and multi-class recognition paired with pixel-exact segmentation masks, followed by high-density landmark mapping, along with isolating facial, structural, and anatomical pose features with geometric precision.', tasks: ['Classification', 'Object Detection', 'Instance Segmentation', 'Semantic Segmentation', 'Keypoint Estimation', 'Image Captioning', 'OCR'] },
    { intro: false, tagline: 'AI Engine', heading: 'Video', desc: 'High-resolution frame extraction combined with motion tracking and temporal segmentation with pixel-level instance masks are persistently tracked across consecutive frames to maintain complete target continuity.', tasks: ['Classification', 'Object Tracking', 'Instance Segmentation', 'Temporal Segmentation', 'Per-Frame Annotation', 'Pose Tracking'] },
    { intro: false, tagline: 'AI Engine', heading: 'Audio', desc: 'Precise, word-level speech transcription with exact timestamps along with advanced acoustic analysis decoding speaker diarization, emotional registery, dynamic tones, and subtle background event sounds.', tasks: ['Transcription', 'Speaker Diarisation', 'Sound Event Detection', 'Classification', 'Emotion Detection', 'Audio Segmentation'] },
    { intro: false, tagline: 'AI Engine', heading: '3D & LiDAR', desc: 'Point-cloud native spatial understanding combining volumetric object detection with persistent multi-frame tracking, dense semantic segmentation, cross-sensor fusion, and scan-to-scan registration for consistent world-frame alignment.', tasks: ['3D Object Detection', '3D Object Tracking', 'Segmentation', 'Sensor Fusion', 'Scan Registration'] }
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

  /* ── Govern page: scroll-driven pixel-dot octagonal prism ──
     Same .layer-scroll/.layer-sticky mechanics as the Label page's AI
     Engines section (see initEngineScroll above), reused for a 9-slide
     sequence: an intro slide, then the 8 governance controls. The canvas
     is a wireframe octagonal prism — 8 flat rectangular side faces
     arranged radially around the Y axis, each built from the same "pixel"
     dot grid + faint edge lines language the old 6-face cube used —
     continuously spinning (dominant motion on Y, the prism's own axis,
     with a slower wobble on X/Z for depth) so it genuinely reads as a
     rotating 3D object, not a flat carousel. Each point's final position
     is a per-point linear blend (not an angle blend, so there's no
     wraparound/gimbal risk — the same technique the AI Engines sphere
     uses for its ring0 "unfurl") between its freely spinning position and
     its position under a fixed target Y-rotation that brings one side
     square onto the viewer. On the intro slide the blend stays at 0 (pure
     free spin, no face highlighted). Scrolling into a control slide eases
     the blend to 1, so the prism "revolves and stops" with that control's
     face centered and its heading faded in beside it; scrolling back out
     eases the blend back to 0 and the spin resumes from wherever it
     currently is (no jump, since free rotation never stops accumulating
     in the background). Rotation/projection formulas and full-cycle
     bounds (all 16 corners + every face's dot grid, across the intro
     spin, every settled face, and the transitions between) verified
     numerically before shipping — see the scratch harness this was built
     against. */
  var GOVERN_SLIDES = [
    { intro: true, tagline: 'Governance', heading: 'Eight Controls, Continuous Governance', desc: 'Eight automated controls run on every dataset, on every layer, every time — provenance, logging, lineage, integrity, quality, export sign-off, compliance documentation, and retention, with no manual audit required.', face: null },
    { intro: false, tagline: 'Governance Control', heading: 'Provenance Tracking', desc: 'Every dataset records its origin — storage backend, file, query, or upload — and that provenance persists through every operation into the final lineage report.', face: 'f0' },
    { intro: false, tagline: 'Governance Control', heading: 'Operation Logging', desc: 'Every transformation, labeling decision, review, and export is logged and cryptographically sealed — SHA-256 hash-chained every five minutes, so tampering with the history isn’t just against policy, it’s mathematically detectable.', face: 'f1' },
    { intro: false, tagline: 'Governance Control', heading: 'Lineage Reports', desc: 'Every version auto-generates a structured lineage document — identity, provenance, transformations, and risk — included with every export.', face: 'f2' },
    { intro: false, tagline: 'Governance Control', heading: 'Version Integrity', desc: 'Every frozen version is SHA-256 hash-verified across data, labels, and metadata — cryptographic proof the export matches what was approved.', face: 'f3' },
    { intro: false, tagline: 'Governance Control', heading: 'Quality Gates', desc: 'Datasets must clear configurable thresholds — detected PII, freeze status, lineage completeness, quality score — before export. Some gates block outright with no override; others warn and require an explicit, audited override. Nothing leaves silently.', face: 'f4' },
    { intro: false, tagline: 'Governance Control', heading: 'Segregation of Duties', desc: 'Exporting a dataset classified “restricted” requires sign-off from a different admin than whoever requested it, enforced on the server. No single person can move your most sensitive data out alone.', face: 'f5' },
    { intro: false, tagline: 'Governance Control', heading: 'Compliance Documentation', desc: 'Every version can generate a real Datasheet for Datasets and an EU AI Act Article 10 evidence pack — provenance, license, consent, and bias examination — assembled automatically, downloadable as a real PDF. Includes a GDPR erasure receipt, cryptographically hashed, for every row removed on request.', face: 'f6' },
    { intro: false, tagline: 'Governance Control', heading: 'Retention Lifecycle', desc: 'Datasets warn before their retention window closes, auto-archive on expiry, and stay recoverable for 30 days before permanent deletion — no manual cleanup, nothing disappears without warning.', face: 'f7' }
  ];

  // The prism lies on its side, drum-style — its own spin axis is
  // horizontal (X), with the octagonal ring in the Y-Z plane. Face k's
  // outward normal sits at angle k*(360/8)° around that ring; rotating by
  // +that angle around X brings it to point at +Z (the "facing the
  // viewer" convention this file already uses — see the old cube's '+Z'
  // being rx:0,ry:0). Generated rather than hand-typed to keep the 8
  // angles exact.
  var GOVERN_FACE_TARGET = (function () {
    var n = 8, out = {};
    for (var k = 0; k < n; k++) out['f' + k] = { rx: (k * 2 * Math.PI / n), ry: 0 };
    return out;
  })();

  function initGovernPrism(canvas) {
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
    // Real perspective (same 1/(1-depth*K) house style as the packet and
    // infinity wireframes elsewhere in this file), not the old flat
    // orthographic version — with 8 faces only 45° apart, orthographic
    // projection let a settled face's ±45° neighbors keep their full
    // on-screen width instead of visibly receding, which is what made the
    // "settled" view read as a flat overlapping grid instead of one clear
    // face on a receding drum. K=0.35 verified to keep the denominator
    // comfortably clear of 0 (stays ≥0.485) across a full simulated
    // free-spin + settle cycle over every corner and face normal.
    var PERSPECTIVE_K = 0.35;
    function project(p, cx, cy, R) {
      var persp = 1 / (1 - p.z * PERSPECTIVE_K);
      return { x: cx + p.x * R * persp, y: cy - p.y * R * persp, depth: p.z };
    }
    function depthAlpha(depth, mul) { return (0.14 + Math.max(0, (depth / 1.8 + 1) / 2) * 0.55) * mul; }

    // Regular octagonal prism lying on its side, drum-style: the ring
    // (octagon cross-section) sits in the Y-Z plane, and the prism's own
    // length/spin axis is X — the axis a real drum or paper-towel roll
    // spins on, not a lazy-susan's vertical one. Apothem (center-to-face
    // distance) fixed at 1 to match the old cube's unit face distance;
    // circumradius and half-side-length follow from the standard regular-
    // polygon relations (apothem = circumradius*cos(π/n), side =
    // 2*apothem*tan(π/n)). HALF_H (half the drum's length, along X) stays
    // equal to the cube-derived unit too, but because it's now the axis
    // running left-right on screen rather than up-down, each face reads
    // as a wide/landscape rectangle instead of a tall/portrait one.
    var N = 8, APOTHEM = 1, HALF_H = 1;
    var CIRCUMRADIUS = APOTHEM / Math.cos(Math.PI / N);
    var HALF_SIDE = APOTHEM * Math.tan(Math.PI / N);

    var FACE_DEFS = [];
    for (var fk = 0; fk < N; fk++) {
      var theta = fk * (2 * Math.PI / N);
      FACE_DEFS.push({
        name: 'f' + fk,
        normal: { x: 0, y: Math.sin(theta), z: Math.cos(theta) },
        u: { x: 0, y: Math.cos(theta), z: -Math.sin(theta) },
        v: { x: 1, y: 0, z: 0 }
      });
    }

    // 16 corners: the ring at the right end of the drum (x=+HALF_H, 0-7),
    // then the mirrored ring at the left end (x=-HALF_H, 8-15), each
    // vertex offset by half a face-angle from the face normals so each
    // face's flat side spans exactly between the two vertices flanking it.
    var CORNERS = [];
    for (var vk = 0; vk < N; vk++) {
      var vAngle = vk * (2 * Math.PI / N) + Math.PI / N;
      CORNERS.push({ x: HALF_H, y: CIRCUMRADIUS * Math.sin(vAngle), z: CIRCUMRADIUS * Math.cos(vAngle) });
    }
    for (var vk2 = 0; vk2 < N; vk2++) {
      CORNERS.push({ x: -HALF_H, y: CORNERS[vk2].y, z: CORNERS[vk2].z });
    }
    var EDGES = [];
    for (var ek = 0; ek < N; ek++) {
      EDGES.push([ek, (ek + 1) % N]);
      EDGES.push([N + ek, N + ((ek + 1) % N)]);
      EDGES.push([ek, N + ek]);
    }
    // Face k's flat side is bounded by vertex (k-1) and vertex k on both
    // rings — used both for the dot grid below and for drawing a solid
    // highlight border around the active face in draw() (verified against
    // each other numerically: this exact quad is the same rectangle the
    // dot grid below describes).
    var FACE_CORNER_IDX = [];
    for (var pk = 0; pk < N; pk++) {
      var prevK = (pk - 1 + N) % N;
      FACE_CORNER_IDX.push([prevK, pk, N + pk, N + prevK]);
    }

    var G = 4, INSET = 0.78;
    var DOTS = [];
    FACE_DEFS.forEach(function (f) {
      for (var i = 0; i < G; i++) {
        for (var j = 0; j < G; j++) {
          var s = (i / (G - 1)) * 2 - 1, t = (j / (G - 1)) * 2 - 1;
          DOTS.push({
            x: f.normal.x * APOTHEM + f.u.x * s * HALF_SIDE * INSET + f.v.x * t * HALF_H * INSET,
            y: f.normal.y * APOTHEM + f.u.y * s * HALF_SIDE * INSET + f.v.y * t * HALF_H * INSET,
            z: f.normal.z * APOTHEM + f.u.z * s * HALF_SIDE * INSET + f.v.z * t * HALF_H * INSET,
            face: f.name
          });
        }
      }
    });

    // X is the prism's own (drum) axis, so it carries the dominant,
    // continuous spin (this is what makes each side arrive at the viewer
    // in turn); Y/Z get a slower wobble purely for depth, same spirit as
    // the cube's three-axis tumble but no longer required to average out
    // to a clean face-on rest state on its own — the settle blend below
    // handles that.
    var freeRotX = 0.6, freeRotY = 0.25, freeRotZ = 0;
    var settle = 0, targetSettle = 0;
    var labelAlpha = 0, targetLabelAlpha = 0;
    var activeFace = null, activeLabel = '';
    var pendingFace = null, pendingLabel = '', hasPending = false;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H / 2;
      var R = Math.min(W, H) * 0.15;
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

      // Solid border around the active face's real rectangle (its 4 exact
      // 3D corners, projected) so it's unambiguous which side is "the
      // one" — the dot boost + floating label alone left that ambiguous.
      if (settle * labelAlpha > 0.01 && activeFace) {
        var hIdx = parseInt(activeFace.slice(1), 10);
        var hCorners = FACE_CORNER_IDX[hIdx].map(function (ci) { return project(finalOf(CORNERS[ci]), cx, cy, R); });
        var hAlpha = settle * labelAlpha;
        ctx.beginPath();
        ctx.moveTo(hCorners[0].x, hCorners[0].y);
        for (var hi = 1; hi < hCorners.length; hi++) ctx.lineTo(hCorners[hi].x, hCorners[hi].y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (hAlpha * 0.05).toFixed(2) + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (hAlpha * 0.85).toFixed(2) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

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
        freeRotX += 0.0052;
        freeRotY += 0.0017;
        freeRotZ += 0.0009;
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

    var prism = initGovernPrism(document.getElementById('governOctagon'));

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
      if (prism) prism.setActive(slide.face, slide.heading);
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

  /* ── Transform page "What It Does" diagram — a rotating sphere of
     connected nodes (an abstract "AI brain" / neural network), standing
     in for an actual anatomical brain which would read as crude at this
     scale. Points are a Fibonacci sphere (even spacing, no lat/lon
     pinching at the poles); each connects to its few nearest neighbours,
     giving the mesh look without an O(n²) line count. Same project/
     depth-alpha language as the other wireframes on this page. */
  function initNeuralSphere(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H, R, nodes, edges;
    var NODE_COUNT = 70, NEIGHBORS = 3;

    function buildNodes() {
      nodes = [];
      var golden = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < NODE_COUNT; i++) {
        var y = 1 - (i / (NODE_COUNT - 1)) * 2;
        var radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
        var theta = golden * i;
        nodes.push({ x: Math.cos(theta) * radiusAtY, y: y, z: Math.sin(theta) * radiusAtY });
      }
      edges = [];
      for (var a = 0; a < nodes.length; a++) {
        var dists = [];
        for (var b = 0; b < nodes.length; b++) {
          if (a === b) continue;
          var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y, dz = nodes[a].z - nodes[b].z;
          dists.push({ i: b, d: dx * dx + dy * dy + dz * dz });
        }
        dists.sort(function (p, q) { return p.d - q.d; });
        for (var k = 0; k < NEIGHBORS; k++) {
          var pair = [a, dists[k].i].sort(function (p, q) { return p - q; });
          var key = pair[0] + '-' + pair[1];
          if (edges._seen && edges._seen[key]) continue;
          if (!edges._seen) edges._seen = {};
          edges._seen[key] = true;
          edges.push(pair);
        }
      }
    }

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      R = Math.min(W, H) * 0.42;
    }
    resize();
    buildNodes();
    window.addEventListener('resize', resize);

    function project(p, cosR, sinR, cosX, sinX, cx, cy) {
      var xr = p.x * cosR + p.z * sinR;
      var zr = p.z * cosR - p.x * sinR;
      var yr = p.y * cosX - zr * sinX;
      var zr2 = zr * cosX + p.y * sinX;
      var persp = 1 / (1 - zr2 * 0.35);
      return { x: cx + xr * R * persp, y: cy - yr * R * persp, depth: zr2 };
    }

    function draw(rotY, tiltX) {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H / 2;
      var cosR = Math.cos(rotY), sinR = Math.sin(rotY);
      var cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
      var proj = nodes.map(function (p) { return project(p, cosR, sinR, cosX, sinX, cx, cy); });

      for (var e = 0; e < edges.length; e++) {
        var a = proj[edges[e][0]], b = proj[edges[e][1]];
        var avgDepth = (a.depth + b.depth) / 2;
        var alpha = 0.06 + Math.max(0, (avgDepth + 1) / 2) * 0.34;
        ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(2) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (var i = 0; i < proj.length; i++) {
        var p = proj[i];
        var depthT = Math.max(0, Math.min(1, (p.depth + 1) / 2));
        var alpha2 = 0.18 + depthT * 0.7;
        var size = 1.6 + depthT * 2.2;
        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha2.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (prefersReduced) {
      draw(0.6, 0.3);
      document.addEventListener('concave:themechange', function () { draw(0.6, 0.3); });
      return;
    }

    var rotY = 0;
    function tick() {
      requestAnimationFrame(tick);
      rotY += 0.0045;
      draw(rotY, 0.3);
    }
    tick();
  }

  /* ── Shared geometry: a geodesic sphere (subdivided icosahedron) — the
     dense, rigid, triangulated-mesh look, built from a real subdivision
     algorithm (not hand-placed points), so the density and structure
     are mathematically consistent at any zoom. Each page below uses it
     differently (full sphere vs. a dome cut from the same mesh) so
     neither repeats the other. */
  function buildGeodesicSphere(subdivisions) {
    var t = (1 + Math.sqrt(5)) / 2;
    var raw = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ];
    var verts = raw.map(function (v) {
      var len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      return { x: v[0] / len, y: v[1] / len, z: v[2] / len };
    });
    var faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    var midCache = {};
    function midpoint(i1, i2) {
      var key = Math.min(i1, i2) + '_' + Math.max(i1, i2);
      if (midCache[key] !== undefined) return midCache[key];
      var a = verts[i1], b = verts[i2];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2;
      var len = Math.sqrt(mx * mx + my * my + mz * mz);
      verts.push({ x: mx / len, y: my / len, z: mz / len });
      var idx = verts.length - 1;
      midCache[key] = idx;
      return idx;
    }
    for (var s = 0; s < subdivisions; s++) {
      var next = [];
      faces.forEach(function (f) {
        var ab = midpoint(f[0], f[1]), bc = midpoint(f[1], f[2]), ca = midpoint(f[2], f[0]);
        next.push([f[0], ab, ca], [f[1], bc, ab], [f[2], ca, bc], [ab, bc, ca]);
      });
      faces = next;
    }
    var edgeSeen = {};
    var edges = [];
    faces.forEach(function (f) {
      [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(function (pair) {
        var key = Math.min(pair[0], pair[1]) + '_' + Math.max(pair[0], pair[1]);
        if (!edgeSeen[key]) { edgeSeen[key] = true; edges.push(pair); }
      });
    });
    return { verts: verts, edges: edges };
  }

  /* ── Label page "What It Does" diagram — a geodesic dome: the lower
     half of the mesh is cut away, standing for the single decision
     threshold that splits every item above it from everything below. */
  function initGeoDome(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var mesh = buildGeodesicSphere(2);
    var edges = mesh.edges.filter(function (e) {
      return mesh.verts[e[0]].y > -0.08 && mesh.verts[e[1]].y > -0.08;
    });

    var W, H, R;
    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      R = Math.min(W, H) * 0.44;
    }
    resize();
    window.addEventListener('resize', resize);

    function project(p, cosR, sinR, cx, cy) {
      var xr = p.x * cosR + p.z * sinR;
      var zr = p.z * cosR - p.x * sinR;
      var persp = 1 / (1 - zr * 0.35);
      return { x: cx + xr * R * persp, y: cy - p.y * R * persp, depth: zr };
    }

    function draw(rotY) {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H / 2;
      var cosR = Math.cos(rotY), sinR = Math.sin(rotY);
      edges.forEach(function (e) {
        var a = project(mesh.verts[e[0]], cosR, sinR, cx, cy);
        var b = project(mesh.verts[e[1]], cosR, sinR, cx, cy);
        var avgDepth = (a.depth + b.depth) / 2;
        var alpha = 0.1 + Math.max(0, (avgDepth + 1) / 2) * 0.45;
        ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(2) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
    }

    if (prefersReduced) {
      draw(0.6);
      document.addEventListener('concave:themechange', function () { draw(0.6); });
      return;
    }
    var rotY = 0;
    function tick() {
      requestAnimationFrame(tick);
      rotY += 0.0018;
      draw(rotY);
    }
    tick();
  }

  /* ── Version page "What It Does" diagram — the full geodesic sphere:
     a single rigid, triangulated, immutable structure, standing for a
     committed version — complete and locked, not a loose assembly. */
  function initGeoSphereFull(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var mesh = buildGeodesicSphere(2);

    var W, H, R;
    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      R = Math.min(W, H) * 0.42;
    }
    resize();
    window.addEventListener('resize', resize);

    function project(p, cosR, sinR, cx, cy) {
      var xr = p.x * cosR + p.z * sinR;
      var zr = p.z * cosR - p.x * sinR;
      var persp = 1 / (1 - zr * 0.35);
      return { x: cx + xr * R * persp, y: cy - p.y * R * persp, depth: zr };
    }

    function draw(rotY) {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H / 2;
      var cosR = Math.cos(rotY), sinR = Math.sin(rotY);
      mesh.edges.forEach(function (e) {
        var a = project(mesh.verts[e[0]], cosR, sinR, cx, cy);
        var b = project(mesh.verts[e[1]], cosR, sinR, cx, cy);
        var avgDepth = (a.depth + b.depth) / 2;
        var alpha = 0.08 + Math.max(0, (avgDepth + 1) / 2) * 0.42;
        ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(2) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
    }

    if (prefersReduced) {
      draw(0.6);
      document.addEventListener('concave:themechange', function () { draw(0.6); });
      return;
    }
    var rotY = 0;
    function tick() {
      requestAnimationFrame(tick);
      rotY += 0.0018;
      draw(rotY);
    }
    tick();
  }



  /* ── Observe page "What It Does" diagram — a torus with a comet dot
     circling it continuously: the observability loop that never stops,
     made literal rather than metaphorical. */
  function initFeedbackTorus(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H, R;
    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      R = Math.min(W, H) * 0.4;
    }
    resize();
    window.addEventListener('resize', resize);

    var MAJOR = 1, MINOR = 0.32, RINGS = 28, TUBE = 10;
    function torusPoint(u, v) {
      var x = (MAJOR + MINOR * Math.cos(v)) * Math.cos(u);
      var z = (MAJOR + MINOR * Math.cos(v)) * Math.sin(u);
      var y = MINOR * Math.sin(v);
      return { x: x, y: y, z: z };
    }
    function project(p, cosR, sinR, cosX, sinX, cx, cy) {
      var xr = p.x * cosR + p.z * sinR;
      var zr = p.z * cosR - p.x * sinR;
      var yr = p.y * cosX - zr * sinX;
      var zr2 = zr * cosX + p.y * sinX;
      var persp = 1 / (1 - zr2 * 0.35);
      return { x: cx + xr * R * persp, y: cy - yr * R * persp, depth: zr2 };
    }
    function strokePts(pts, cosR, sinR, cosX, sinX, cx, cy, rgb) {
      var proj = pts.map(function (p) { return project(p, cosR, sinR, cosX, sinX, cx, cy); });
      var avgDepth = 0;
      proj.forEach(function (p) { avgDepth += p.depth; });
      avgDepth /= proj.length;
      var alpha = 0.06 + Math.max(0, (avgDepth + 1) / 2) * 0.4;
      ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      proj.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    }

    function draw(rotY, cometT) {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H / 2;
      var cosR = Math.cos(rotY), sinR = Math.sin(rotY);
      var cosX = Math.cos(0.5), sinX = Math.sin(0.5);

      for (var i = 0; i < RINGS; i++) {
        var u = (i / RINGS) * Math.PI * 2;
        var pts = [];
        for (var j = 0; j <= TUBE; j++) pts.push(torusPoint(u, (j / TUBE) * Math.PI * 2));
        strokePts(pts, cosR, sinR, cosX, sinX, cx, cy, rgb);
      }
      for (var k = 0; k < TUBE; k++) {
        var v2 = (k / TUBE) * Math.PI * 2;
        var pts2 = [];
        for (var m = 0; m <= RINGS; m++) pts2.push(torusPoint((m / RINGS) * Math.PI * 2, v2));
        strokePts(pts2, cosR, sinR, cosX, sinX, cx, cy, rgb);
      }
      var cometP = torusPoint(cometT, 0);
      var proj = project(cometP, cosR, sinR, cosX, sinX, cx, cy);
      var depthT = Math.max(0, Math.min(1, (proj.depth + 1) / 2));
      ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (0.5 + depthT * 0.5).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 2.5 + depthT * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (prefersReduced) {
      draw(0.6, 0);
      document.addEventListener('concave:themechange', function () { draw(0.6, 0); });
      return;
    }
    var rotY = 0, cometT = 0;
    function tick() {
      requestAnimationFrame(tick);
      rotY += 0.003;
      cometT += 0.02;
      draw(rotY, cometT);
    }
    tick();
  }

  /* ── Govern page "What It Does" diagram — a literal chain: alternating
     interlocked rings, standing for the immutable, linked audit trail. */
  function initAuditChain(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    var W, H, R;
    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      R = Math.min(W, H) * 0.4;
    }
    resize();
    window.addEventListener('resize', resize);

    var LINKS = 6, SPACING = 0.34, LINK_R = 0.26, TUBE_R = 0.09, SEGS = 22, TUBE_SEGS = 10;
    function linkPoint(linkIndex, u, v, vertical) {
      var cx0 = (linkIndex - (LINKS - 1) / 2) * SPACING;
      var baseX, baseY, baseZ;
      if (!vertical) {
        baseX = Math.cos(u) * (LINK_R + TUBE_R * Math.cos(v));
        baseY = Math.sin(u) * (LINK_R + TUBE_R * Math.cos(v));
        baseZ = TUBE_R * Math.sin(v);
      } else {
        baseX = TUBE_R * Math.sin(v);
        baseY = Math.sin(u) * (LINK_R + TUBE_R * Math.cos(v));
        baseZ = Math.cos(u) * (LINK_R + TUBE_R * Math.cos(v));
      }
      return { x: cx0 + baseX, y: baseY, z: baseZ };
    }
    function project(p, cosR, sinR, cx, cy) {
      var xr = p.x * cosR + p.z * sinR;
      var zr = p.z * cosR - p.x * sinR;
      var persp = 1 / (1 - zr * 0.35);
      return { x: cx + xr * R * persp, y: cy - p.y * R * persp, depth: zr };
    }
    function strokePts(pts, cosR, sinR, cx, cy, rgb) {
      var proj = pts.map(function (p) { return project(p, cosR, sinR, cx, cy); });
      var avgDepth = 0;
      proj.forEach(function (p) { avgDepth += p.depth; });
      avgDepth /= proj.length;
      var alpha = 0.08 + Math.max(0, (avgDepth + 1) / 2) * 0.5;
      ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      proj.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    }

    function draw(rotY) {
      ctx.clearRect(0, 0, W, H);
      if (W < 2 || H < 2) return;
      var rgb = fgRGB();
      var cx = W / 2, cy = H / 2;
      var cosR = Math.cos(rotY), sinR = Math.sin(rotY);

      for (var l = 0; l < LINKS; l++) {
        var vertical = l % 2 === 1;
        for (var t = 0; t < TUBE_SEGS; t++) {
          var v = (t / TUBE_SEGS) * Math.PI * 2;
          var pts = [];
          for (var u = 0; u <= SEGS; u++) pts.push(linkPoint(l, (u / SEGS) * Math.PI * 2, v, vertical));
          strokePts(pts, cosR, sinR, cx, cy, rgb);
        }
      }
    }

    if (prefersReduced) {
      draw(0.6);
      document.addEventListener('concave:themechange', function () { draw(0.6); });
      return;
    }
    var rotY = 0;
    function tick() {
      requestAnimationFrame(tick);
      rotY += 0.0035;
      draw(rotY);
    }
    tick();
  }

  /* ── Observe page: loop-panel rectangle dot + card highlighting ──
     The dot used to be a pure SMIL animateMotion riding a path drawn in a
     fixed 1200x700 viewBox with preserveAspectRatio="none" — fine while
     the panel's real aspect ratio stayed close to 1200:700, but with 10
     cards (vs. the original 6) the panel got much taller, so that fixed
     viewBox got stretched far more vertically than horizontally. A circle
     under non-uniform scaling renders as an ellipse (the "too big" dot),
     and constant arc-length motion in the distorted coordinate space reads
     as uneven speed on screen (fast along the axis stretched less, slow
     along the one stretched more).
     Fix: measure the panel's actual rendered pixel size and set the SVG's
     viewBox to match exactly (1:1, no scaling in either axis), recomputed
     on resize. The rectangle's four edges are then placed through the real
     center of one representative card per edge (not a guessed inset) —
     that guess is what left the side cards floating off the line while the
     top/bottom ones happened to line up. The dot is driven directly from
     JS every frame — arc-length-parameterized around that real rectangle,
     so speed is genuinely constant — instead of SMIL, which also makes it
     trivial to know which edge/card the dot is currently over and light
     that card up (.is-loop-active) as it passes, like :hover on a timer. */
  /* ── Images page "Task Types" — continuously scrolling card strip with
     a scale "spotlight" on whatever's centered. The track holds the card
     list twice back to back; once it has scrolled exactly one set's
     width, that offset is subtracted back off, which — since the second
     set is identical to the first — is invisible to the eye and gives an
     infinite loop without ever resetting to a visibly different frame. */
  function initImgCarousel() {
    var root = document.getElementById('imgCarousel');
    var track = document.getElementById('imgCarouselTrack');
    if (!root || !track) return;
    var cards = Array.prototype.slice.call(track.children);
    if (!cards.length) return;

    // Markup holds the set twice; add a third so there are always cards on
    // both sides of the active one while it steps through the middle set.
    var setCount = cards.length / 2;
    for (var i = 0; i < setCount; i++) {
      var cl = cards[i].cloneNode(true);
      cl.setAttribute('aria-hidden', 'true');
      track.appendChild(cl);
    }
    cards = Array.prototype.slice.call(track.children);

    var HOLD = 2800;   // ms a card stays centered
    var MOVE = 450;    // ms for the quick hop to the next card
    var SCALES = [1.2, 1.02, 0.86]; // by distance from the active card (2+ share the last)
    var cardW, gap, index = setCount; // start on the first card of the middle set

    function measure() {
      cardW = cards[0].offsetWidth;
      gap = parseFloat(getComputedStyle(cards[0]).marginRight) || 0; // negative = overlap
    }

    function place(animate) {
      var ease = animate ? 'transform ' + MOVE + 'ms cubic-bezier(.22,.8,.24,1)' : 'none';
      track.style.transition = ease;
      track.style.transform = 'translateX(' + (root.clientWidth / 2 - (index * (cardW + gap) + cardW / 2)) + 'px)';
      cards.forEach(function (card, n) {
        var k = Math.min(SCALES.length - 1, Math.abs(n - index));
        card.style.transition = animate ? 'transform ' + MOVE + 'ms cubic-bezier(.22,.8,.24,1), opacity ' + MOVE + 'ms ease' : 'none';
        // Only the active card and two on each side are shown (the strip is five wide).
        card.style.opacity = Math.abs(n - index) > 2 ? '0' : '1';
        card.style.transform = 'scale(' + SCALES[k] + ')';
        card.style.zIndex = Math.round(SCALES[k] * 100);
      });
    }

    function next() {
      index++;
      place(true);
      if (index >= setCount * 2) {
        // Landed on the start of the third set — identical to the middle
        // set's start, so jump back there once the hop has finished.
        setTimeout(function () {
          index = setCount;
          place(false);
        }, MOVE + 30);
      }
    }

    measure();
    place(false);
    window.addEventListener('resize', function () { measure(); place(false); });
    if (!prefersReduced) setInterval(next, HOLD + MOVE);

    // Video cards play while the strip is on screen, pause when it isn't.
    var vids = root.querySelectorAll('video');
    if (vids.length && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          vids.forEach(function (v) {
            if (e.isIntersecting && !prefersReduced) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
            else v.pause();
          });
        });
      }, { threshold: 0.1 }).observe(root);
    }
  }

  // Videos inside the modality card row: play only the ones that are both
  // on screen and currently displayed (the bright/dark pair swaps by theme).
  // Split-scroll showcase (.sx): the pinned card steps through its topics as the
  // page scrolls past it; clicking a topic scrolls to that step.
  function initSplitScroll() {
    document.querySelectorAll('.sx').forEach(function (sx) {
      var tabs = sx.querySelectorAll('.sx-tab');
      var panels = sx.querySelectorAll('.sx-panel');
      var n = tabs.length;
      if (!n) return;
      sx.style.setProperty('--sx-n', n);
      var current = -1;
      function show(i) {
        if (i === current) return;
        current = i;
        tabs.forEach(function (b, k) { b.classList.toggle('is-active', k === i); b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
        panels.forEach(function (p, k) { p.classList.toggle('is-active', k === i); });
      }
      function pinned() { return window.innerWidth > 900; }
      function update() {
        if (!pinned()) return;
        var r = sx.getBoundingClientRect();
        var range = sx.offsetHeight - sx.querySelector('.sx-pin').offsetHeight;
        var p = Math.min(0.9999, Math.max(0, -(r.top - 100) / Math.max(1, range)));
        show(Math.floor(p * n));
        sx.style.setProperty('--sx-p', (p * n - Math.floor(p * n)).toFixed(3));
      }
      tabs.forEach(function (b, i) {
        b.addEventListener('click', function () {
          if (!pinned()) { show(i); return; }
          var range = sx.offsetHeight - sx.querySelector('.sx-pin').offsetHeight;
          var top = sx.getBoundingClientRect().top + window.pageYOffset - 100;
          window.scrollTo({ top: top + ((i + 0.5) / n) * range, behavior: prefersReduced ? 'auto' : 'smooth' });
          show(i);
        });
      });
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      show(0);
      update();
    });
  }

  // Rotating LiDAR point-cloud of a car (3D & LiDAR scroll panel): the model spins a
  // full 360 degrees while a scan band sweeps up it and rings pulse out on the ground.
  var SX_CAR = [-108,16,16,72,16,16,76,24,44,44,-44,36,56,-12,52,104,36,20,60,-44,40,16,28,60,88,-20,44,-40,-44,24,-76,44,32,8,-40,44,-76,44,16,112,12,28,-4,44,28,-108,28,40,96,12,16,72,-4,44,84,-12,16,44,20,56,20,36,48,48,-12,16,-60,-44,4,-4,12,16,-24,-20,16,-8,-36,48,-24,4,64,-96,-32,16,-104,20,16,-56,-44,16,-32,-28,16,12,-28,60,-40,28,16,-68,-40,44,-80,-40,44,-56,-44,24,24,-32,16,96,-8,44,92,32,44,56,-24,16,-4,44,40,-72,28,44,104,-36,24,-88,32,44,-40,44,36,72,-44,44,-12,24,60,-108,-28,24,40,16,16,104,36,40,108,28,32,-84,-20,16,40,44,32,-8,40,16,8,28,60,20,4,16,84,44,12,44,44,40,88,40,20,-108,-28,28,68,32,4,-24,-24,16,40,24,56,32,-4,64,-72,-44,16,-80,12,16,68,-44,44,-52,40,12,-84,-28,16,84,24,16,-48,0,16,100,24,44,92,24,16,36,24,16,52,24,48,-84,40,44,28,44,28,36,28,56,60,44,4,100,0,16,68,4,44,-52,24,16,20,44,20,80,32,8,84,32,12,16,44,40,-60,-4,44,104,-36,36,-92,28,16,92,36,16,84,-40,32,-20,44,24,32,-44,20,-20,20,16,-16,24,60,-56,20,44,68,44,8,-88,8,16,112,4,16,-104,-36,44,20,-8,68,-16,36,16,12,4,16,32,-24,60,72,-8,16,20,-16,16,-80,-4,16,76,20,44,56,44,16,28,0,16,-12,4,68,-60,-16,44,80,44,12,84,44,8,-92,-32,44,68,20,44,44,24,56,52,20,16,60,44,32,-24,8,16,40,12,60,-96,32,44,-76,24,44,0,32,56,56,-44,16,36,20,60,80,0,16,12,8,68,-52,-28,16,-104,8,44,52,-32,44,-56,44,32,60,-24,44,-12,40,44,112,-12,24,56,-4,56,-32,-8,60,-8,-8,16,4,-44,36,-104,4,16,-104,-8,16,108,16,44,-44,-12,56,-104,-36,32,112,8,24,44,-24,16,24,36,16,-40,-12,56,-72,24,16,-8,24,64,-84,40,36,-36,32,16,80,44,36,-64,16,16,-80,8,16,-80,44,24,-72,20,16,-52,32,44,92,40,16,-64,-44,8,0,-24,16,-80,28,16,24,-12,64,-28,-20,16,72,-44,4,112,8,16,-44,4,16,-112,12,36,64,-32,12,100,32,44,60,16,44,72,-44,24,60,36,4,-40,44,16,28,-8,16,-104,32,20,32,44,32,-76,-12,16,-72,-24,44,-36,0,16,4,-44,44,8,-4,72,-68,44,40,-68,-4,16,-108,-28,20,100,-32,16,-24,44,44,-68,44,28,-108,12,44,-12,-16,64,0,36,52,16,-44,36,44,-44,16,0,-36,16,-112,0,40,40,44,28,-16,32,56,-8,44,20,-88,-40,28,56,-20,16,88,-12,16,52,-24,48,100,-12,16,-40,44,24,100,36,28,-84,8,44,16,-16,16,-44,40,44,92,-32,44,-8,-32,56,8,36,16,108,24,36,100,-36,28,-24,-32,52,-72,8,16,52,-44,32,72,-24,44,88,-40,40,-12,-8,68,4,-44,40,-52,40,44,-40,-20,52,68,0,16,48,-44,24,48,24,48,16,-28,60,36,-44,32,76,4,44,24,4,68,96,40,40,12,16,64,-64,-28,16,-64,36,4,92,-24,16,76,44,44,-40,-36,16,-100,16,44,112,16,16,92,-16,16,28,8,64,48,20,16,52,-16,56,36,40,44,-112,-4,20,68,-28,44,-76,-32,4,100,8,44,-56,8,16,-108,-8,44,-100,16,16,-28,44,20,-44,24,44,-60,-8,16,-32,44,28,28,-44,16,104,-24,44,-24,16,16,40,4,64,4,36,48,-80,20,44,-60,40,44,52,12,16,-48,28,16,0,-8,16,68,44,4,20,8,68,12,-32,16,-80,0,44,-40,-4,60,-80,36,44,-4,-4,16,84,-36,12,104,-32,44,4,-4,16,72,-36,4,56,12,16,12,-36,16,-76,44,8,-72,-24,16,12,44,36,-16,32,16,96,-16,16,-20,-8,16,84,-24,16,0,44,28,104,-16,44,-100,-28,16,20,-12,16,72,28,44,36,8,64,-8,44,44,-108,28,32,-52,44,16,64,-8,16,-112,0,16,100,32,16,28,8,16,84,-8,44,44,-36,16,-84,20,44,112,-12,40,88,-40,36,64,-44,28,-16,-44,24,88,-20,16,48,-44,20,-88,-40,20,108,-28,44,-44,-4,16,-16,16,64,88,-4,16,0,-24,64,4,36,52,-12,-32,56,-8,28,16,-40,20,52,92,16,44,72,-44,8,-12,-8,16,32,20,16,-80,44,44,20,0,68,-96,8,44,-76,20,16,-100,12,44,88,24,44,28,16,16,-56,16,44,-108,20,28,-100,-36,36,-56,-8,16,-48,44,44,-44,-40,16,-24,32,16,-44,4,56,108,-12,44,-72,32,8,72,24,44,-72,-36,44,72,36,4,-108,24,16,36,-12,64,40,36,16,-48,-36,44,-96,-40,40,72,-44,36,-56,-44,40,96,28,44,-48,-24,16,20,40,16,-112,-4,36,-64,-44,40,-12,44,16,60,28,44,-80,-16,44,-60,-44,36,-16,-4,68,-76,-40,44,92,-40,44,112,16,20,-68,-44,32,108,24,44,16,40,16,40,-36,16,36,44,40,-36,8,60,-4,44,16,-24,-36,44,-44,44,28,-80,-44,44,52,-32,12,80,24,44,-32,-44,32,-72,40,44,84,24,44,92,-40,40,84,-40,12,88,-28,16,-88,24,44,64,20,16,-20,12,16,-84,-40,32,12,44,28,-112,-8,20,108,-20,16,-24,-8,64,-8,-44,40,-16,20,64,-8,-36,16,-104,-32,16,-96,-16,16,-76,24,16,-60,32,12,-76,-16,44,-64,-32,8,60,12,16,68,24,44,100,-24,16,-32,-44,28,64,16,44,-24,-32,48,-12,-44,36,-44,44,40,76,-28,16,56,-8,56,48,44,32,-12,-4,16,-112,16,36,-56,40,8,-76,-44,8,-84,44,12,108,-28,28,88,-8,44,-112,8,36,56,-32,8,-68,4,16,92,-40,24,-48,-36,16,32,-32,52,0,4,16,-68,44,8,32,40,16,48,44,28,32,-12,64,-36,28,16,108,12,16,0,44,24,-64,28,44,-56,-44,36,-96,0,16,72,-20,44,92,20,16,76,-44,36,-104,-36,28,4,44,36,76,12,16,24,-40,44,-80,-44,20,-28,-44,24,-44,20,16,112,4,28,24,0,68,80,-16,16,-92,12,44,76,32,8,-104,-20,16,64,-44,36,28,36,16,-16,40,16,40,0,64,-4,-44,28,-72,44,16,16,36,52,-108,24,28,60,0,52,-36,-28,16,28,-32,52,-88,40,24,-48,-44,40,28,28,56,-8,-24,16,-64,44,28,-64,-24,44,-52,-36,44,-60,24,16,-104,28,16,-4,4,68,28,-44,20,-72,16,16,-88,-4,44,96,-12,16,36,0,64,12,0,16,-112,0,24,56,32,44,68,-4,44,12,-40,16,-32,16,16,88,40,16,92,-28,44,-32,-28,48,40,-44,36,-60,-8,44,-12,-12,16,-4,-28,60,-92,36,44,-60,-44,28,-52,-8,16,-24,-28,16,-92,-40,16,-52,-44,40,0,20,64,48,-32,16,92,36,44,-76,-8,44,60,8,16,-112,-16,36,60,-44,16,64,-44,8,-84,-16,44,-16,-44,20,-56,-44,32,104,32,44,-28,-36,44,60,-28,44,-80,8,44,-16,-32,52,-4,-8,68,-108,24,32,48,-20,16,28,-16,64,112,-12,36,104,24,44,108,-24,44,-12,20,64,68,44,44,80,-12,44,-92,24,44,-20,16,16,-108,24,44,-92,-40,40,-20,-44,44,-8,36,16,112,4,36,-28,-44,32,48,-4,16,-84,44,24,32,16,16,-80,4,44,112,16,28,64,-24,16,16,-32,16,-60,44,20,12,-44,16,-4,0,68,-88,4,16,0,-44,32,-76,-44,28,-64,-40,4,-36,4,16,-24,-44,32,68,44,20,16,-28,16,-36,44,40,-44,12,16,72,-24,16,-100,-12,16,-40,-40,16,-16,-20,16,-36,20,16,92,-4,16,-72,0,44,112,12,24,-44,28,16,-96,40,40,-48,-28,44,40,12,16,-84,-28,44,4,-8,16,112,-16,24,12,0,72,-8,44,16,80,-44,8,100,-4,44,-84,-4,16,-20,32,48,8,-8,68,32,36,44,-16,-32,56,-68,40,44,16,-44,16,60,-32,12,-96,20,16,-76,32,8,-40,36,44,88,40,24,-48,40,44,88,-16,16,104,-32,16,-88,-32,16,84,20,16,-24,44,20,-16,-24,60,-12,4,16,-72,-20,44,112,0,40,-68,36,44,40,24,16,-88,-40,16,-24,0,16,-28,-16,60,-80,0,16,-36,28,48,-36,36,44,-100,-36,40,20,-32,56,-76,28,16,-64,24,16,0,-44,24,52,-44,28,-8,-44,20,-60,24,44,40,-32,44,76,44,4,-88,12,16,0,-44,20,-108,8,16,96,16,16,80,32,44,-52,44,44,-112,-12,16,96,-28,44,84,-32,12,112,0,36,-60,44,44,36,0,16,-84,-40,40,-92,20,16,-104,-12,16,104,20,44,60,-32,8,72,44,8,104,36,36,-44,-20,16,-36,40,44,-52,16,44,56,-4,16,36,44,28,-32,-44,40,-84,16,16,-60,-12,16,-64,4,44,12,44,32,44,8,16,52,0,60,-48,-28,16,-72,-12,44,-16,-12,64,-56,-24,16,44,40,44,48,-44,32,100,-12,44,-4,-40,44,28,-4,16,32,8,64,76,-8,44,108,-20,40,-112,4,24,36,-32,16,108,-20,36,8,-32,56,108,28,16,8,-44,16,-56,-44,12,-92,-8,44,76,40,4,80,-24,16,-64,-36,4,28,-12,16,-76,32,44,-96,-24,44,112,-8,28,76,-12,16,8,-28,60,52,36,12,56,-44,28,-72,-32,8,16,-24,16,-112,8,32,80,20,16,60,-20,16,-12,-44,40,48,36,16,60,-32,44,20,8,16,-52,16,16,-76,44,44,100,36,24,-96,-12,16,64,28,16,72,44,20,32,-44,32,76,-24,44,76,-32,12,108,20,28,80,-28,16,-112,-12,32,-80,28,44,-24,-4,16,68,16,16,-28,20,60,64,-12,44,-104,32,36,44,40,16,-8,12,16,-48,-16,48,40,-4,16,-96,36,44,-72,-20,16,-64,12,44,-60,-40,4,104,20,16,64,44,40,44,-40,44,96,40,20,-76,-44,36,96,-20,16,-88,-8,16,-52,-20,16,-68,-44,8,24,-20,16,12,32,16,-100,36,16,-68,-4,44,84,40,36,52,20,52,80,32,12,-48,44,40,-16,-16,64,76,16,44,-56,-28,16,64,44,16,-52,44,40,100,28,16,-68,-44,44,100,20,16,-88,28,16,72,40,44,-112,4,36,108,-28,36,84,-28,16,-112,12,20,-28,44,24,-24,36,44,8,36,52,-40,4,16,20,-24,16,-80,44,40,28,4,64,92,-24,44,44,-44,20,24,-36,48,-76,44,28,-100,-36,24,12,24,16,32,-44,16,96,40,28,-64,-20,44,8,-44,28,40,8,64,44,-44,32,100,-36,16,112,12,40,-24,-40,44,68,44,32,-80,-12,44,-44,28,44,-36,24,52,96,32,16,36,-16,16,-104,12,44,84,-16,16,-84,4,44,32,16,64,-104,12,16,-100,36,44,80,-44,32,-72,44,44,52,8,16,76,-4,16,-32,-12,60,-88,-40,36,92,-16,44,68,-4,16,96,-40,16,-56,-16,16,28,36,48,56,0,16,-72,44,12,108,28,44,-108,-28,36,64,-40,4,60,-44,28,-84,-8,44,80,-44,20,-36,-16,56,-44,8,16,60,0,16,92,8,16,-84,-16,16,112,0,32,104,32,28,88,12,16,68,-44,24,-48,32,16,-16,8,64,-108,20,24,72,24,16,-52,-44,12,-104,4,44,-36,8,16,-32,-44,44,-36,44,36,-28,28,16,-104,16,44,-92,-40,24,-92,-24,16,-72,44,24,8,8,16,52,-12,56,-64,0,16,-112,4,16,12,44,40,112,-16,40,-4,0,16,-92,-40,28,-8,8,68,60,-4,16,76,-20,16,-92,40,44,8,24,64,104,32,24,-56,-12,16,80,44,40,96,-40,40,36,-28,56,-108,24,20,-76,-44,44,112,16,40,-64,32,4,64,-44,32,16,-44,28,84,-44,16,-64,44,20,-4,44,44,20,-44,28,-80,44,32,4,0,16,80,44,28,-20,44,20,104,-12,44,92,0,16,36,16,60,-88,-32,44,-56,32,12,-12,-44,32,56,8,56,36,-24,16,-96,-4,44,-16,-44,28,88,-32,44,24,8,68,-112,8,20,-88,-12,16,112,-12,28,76,44,8,-108,-16,44,-20,-16,16,88,-12,44,48,24,52,20,-44,32,-24,28,16,112,-8,20,-12,-28,16,-40,-16,16,104,-32,32,56,28,16,16,-8,16,-52,28,16,-84,-20,44,-28,-44,40,72,32,4,52,-44,20,20,24,60,-36,24,16,-28,8,16,-24,-16,64,-92,-12,44,-48,-44,32,-56,0,44,12,-32,56,56,32,8,-108,24,36,88,8,16,36,-28,52,64,32,8,-56,44,44,92,0,44,-72,32,4,-100,-36,16,72,-4,16,108,-28,24,-48,-40,44,-28,-12,16,-56,-4,16,-24,44,40,12,-12,68,40,-36,44,76,16,16,-28,28,52,8,-28,16,-28,12,64,-4,-32,16,-56,28,44,-76,-44,12,112,8,44,40,-44,44,92,28,16,80,4,44,16,44,36,36,32,16,-28,16,16,92,12,44,-4,44,20,-4,16,64,40,44,36,-68,-8,16,-60,-28,16,56,16,52,96,-24,16,92,4,16,-104,-36,16,-40,-8,60,-40,44,40,96,40,16,96,-40,36,-68,-24,44,-76,-44,20,96,-36,16,44,-44,24,-56,-40,44,80,-20,44,84,-4,16,-44,24,16,-40,44,32,-64,-44,16,-24,-28,56,-32,-32,44,0,-44,44,-12,-44,20,-84,-40,36,-20,28,56,-112,8,40,60,32,44,0,-28,60,68,-32,4,4,4,16,-28,0,64,-100,0,16,96,-40,24,-72,-32,12,-52,0,16,-92,-20,16,80,-36,44,-76,32,4,48,-28,44,-28,-28,52,-60,-24,16,24,-8,16,80,-20,16,56,4,56,64,44,36,24,-12,16,-84,32,8,16,44,32,-108,-16,16,20,44,28,48,-4,60,-72,-28,16,-8,-32,16,-24,-40,16,112,0,16,-72,-44,40,-16,-36,48,36,44,24,20,20,64,24,24,60,96,-8,16,-100,-16,16,-36,-44,32,-80,40,4,44,-16,16,16,28,16,12,20,64,-16,24,16,-60,-20,16,24,12,16,0,28,16,-80,-8,44,-112,16,40,24,-44,32,-104,-12,44,-60,-44,20,60,44,28,84,8,44,40,-44,40,104,32,16,32,32,16,-16,0,68,-4,-12,16,80,-44,36,76,-44,4,64,40,44,-68,44,36,92,40,44,88,32,16,-80,-24,16,24,4,16,-96,-12,44,-76,-4,44,44,-8,16,-100,-28,44,4,44,16,76,44,28,52,40,44,0,-40,44,-28,40,44,-104,-32,32,-112,-8,24,84,12,44,-68,-12,16,-24,44,28,56,16,48,84,8,16,56,16,16,-84,0,16,56,36,44,-48,12,52,20,-32,16,76,-44,32,-64,-44,32,-108,12,16,48,-16,56,-24,-44,20,-4,-44,44,-12,40,16,36,44,16,-92,-36,44,56,44,12,-84,20,16,-36,12,16,12,32,56,-28,-24,16,104,16,44,20,24,16,-108,-20,24,44,4,16,112,-16,28,-100,-4,16,-28,40,16,-92,40,36,84,-20,44,-72,-8,44,-36,-12,16,4,-40,16,-32,-20,56,-36,0,60,8,32,56,-108,4,16,56,32,12,-52,24,44,52,28,16,72,-28,16,60,40,4,-8,-16,16,-88,-16,16,-64,44,36,92,32,16,-20,44,44,-104,-32,36,-112,-8,40,-72,-16,16,-8,40,44,8,44,16,-100,8,16,64,-44,24,-84,-12,16,100,0,44,28,-40,16,20,44,40,-100,12,16,68,32,8,104,-36,16,84,-40,8,-76,12,44,-104,-16,44,84,-4,44,-76,-44,4,-88,-12,44,104,32,32,64,-32,8,48,12,16,-20,32,52,-36,16,16,-88,-20,44,56,40,44,40,44,40,-84,36,44,-100,-32,16,-16,-40,44,-80,-44,28,108,-20,28,44,28,16,4,-28,16,-100,28,16,88,36,44,24,-32,52,-64,16,44,-48,4,52,32,-20,60,-84,12,44,32,32,52,-64,40,44,-68,32,8,84,28,16,-76,-16,16,-64,8,44,-32,-44,16,32,44,28,8,-44,36,84,0,44,-12,28,16,80,-24,44,-40,-36,44,-100,-20,44,-4,36,16,-8,-16,64,-24,-12,64,-24,44,16,-108,20,16,96,4,16,-8,44,40,-72,36,4,16,-40,44,-104,36,44,16,32,16,28,44,20,36,-44,20,-32,32,44,-68,-44,4,4,0,72,-56,36,44,4,-40,44,-104,-16,16,-92,-40,32,-16,44,44,12,-8,16,108,24,28,52,-44,24,44,12,60,100,-36,40,40,4,16,48,-44,44,108,28,40,20,44,24,-84,40,40,-104,-32,40,12,28,60,32,20,60,-72,44,4,-20,12,64,36,16,16,-32,24,16,28,-36,48,-112,0,20,48,20,56,-44,0,16,0,-12,68,-72,-44,24,64,-44,12,28,40,44,64,44,44,-92,-40,44,-48,20,16,-96,-32,44,-64,-32,44,-80,-44,24,-24,12,16,68,-24,44,-112,12,44,-112,-8,44,-48,-20,44,12,-40,44,92,20,44,-80,-44,40,-108,-24,20,16,4,16,-48,44,36,96,40,36,-4,-20,64,68,28,44,72,44,12,100,-16,16,-104,-36,40,-32,28,52,-72,40,4,-52,-44,32,-68,-36,44,20,12,16,-80,-16,16,48,28,16,-60,12,44,100,-28,44,84,-44,12,-104,24,44,-40,8,60,-56,-4,44,64,44,20,-56,-32,44,80,44,4,-104,36,40,112,-4,40,-92,0,44,-24,32,52,-112,-12,28,92,-4,44,4,-36,52,4,12,16,48,-12,60,8,-20,16,-40,-44,44,32,24,60,108,20,40,-48,-24,44,40,0,16,-24,4,16,-16,8,16,-84,8,16,-84,40,8,8,-20,64,36,-16,60,20,-44,40,76,-16,16,4,44,44,68,40,44,44,-12,16,-100,-36,44,60,-44,44,-96,8,16,12,-4,16,72,-32,8,92,-40,36,-104,32,32,40,-28,52,28,32,56,92,40,24,-48,-44,44,84,40,32,-96,40,36,-88,12,44,92,-36,16,52,44,16,36,-36,44,-60,44,12,-96,12,44,-80,32,8,-20,-44,36,52,-8,56,-20,-12,16,-84,40,32,28,24,60,8,20,64,-48,-8,16,28,32,16,-36,-32,44,36,28,52,-112,16,16,48,40,16,-104,-8,44,100,-16,44,60,24,16,36,-44,28,12,-4,68,-36,44,16,60,4,52,72,0,16,84,44,28,72,-32,12,-68,-32,8,-72,-44,8,-112,-16,40,40,-44,16,-52,36,44,16,-44,24,-80,16,16,-48,-40,16,48,8,16,108,8,16,92,4,44,112,12,16,44,-20,16,-40,40,44,-100,28,44,-104,36,20,36,44,32,68,32,44,108,0,16,56,44,24,84,-32,8,-20,32,16,60,-44,32,32,-32,48,108,24,20,56,44,40,-36,36,16,-8,-40,16,64,24,44,-48,0,56,72,36,44,-8,-44,16,-40,36,16,64,12,44,4,-44,24,-88,24,16,-28,32,16,16,-32,56,80,36,4,-104,-4,44,24,-44,44,16,-40,16,8,8,68,-56,-12,44,-100,-36,32,84,40,8,-104,0,16,-76,-32,44,-52,20,44,-108,-28,16,-72,-44,4,-48,24,44,-8,44,24,80,4,16,-40,-44,36,-96,-40,44,-36,-4,60,-44,-36,16,-28,-16,16,36,24,56,-60,44,40,0,-44,36,-108,-20,16,-60,-44,40,64,20,44,-104,36,36,-52,-16,16,56,28,44,48,8,60,96,12,44,108,24,16,-48,-12,48,-56,-24,44,68,-28,16,104,0,44,32,24,16,72,-44,16,48,12,60,56,-36,8,-92,40,24,108,24,32,84,0,16,-60,32,44,-68,-32,44,-84,-4,44,16,-44,32,-28,-44,16,80,-44,12,-84,16,44,60,-40,4,-44,44,20,-20,-28,16,-32,-4,64,-112,16,24,-60,12,16,-104,-28,16,56,36,8,-72,32,12,28,28,16,-16,-32,16,-60,-32,8,28,-36,16,-8,-28,16,-60,-16,16,-20,-40,44,8,0,72,8,44,24,16,36,16,60,-8,48,64,-36,4,88,0,16,12,-44,24,-56,44,16,0,36,48,80,0,44,-68,28,44,64,-28,16,104,36,44,-40,4,60,-72,12,44,-16,44,28,68,-44,4,80,32,4,-56,8,44,104,-32,36,-68,32,12,0,12,16,4,-44,20,-52,12,44,-92,-4,16,80,44,20,-44,-44,40,40,28,48,100,-8,16,-76,16,44,112,4,20,-100,-24,16,60,-12,16,60,-16,16,60,44,12,112,0,24,24,-44,16,108,-24,24,4,12,68,44,32,16,80,28,16,104,-36,28,108,-12,16,-100,36,28,52,44,24,52,-28,44,92,-32,16,-24,8,64,-20,8,16,60,-24,16,-36,-24,52,-88,20,44,-92,-28,44,-56,44,24,56,-44,44,72,12,44,4,-20,16,72,16,44,-80,-32,4,100,16,16,-56,-44,8,8,16,64,-36,-44,44,88,0,44,-92,32,44,0,-8,68,-36,12,60,-20,40,44,52,-24,16,56,20,16,-28,-44,20,64,4,16,-84,-44,24,44,36,44,-16,-20,64,-72,-44,28,-96,16,44,72,40,4,48,32,16,104,-4,16,112,-12,44,0,40,16,96,36,16,-108,-24,36,20,44,44,-8,-4,68,-76,44,40,88,32,44,-8,36,52,12,-24,64,-72,-44,32,92,40,36,-76,40,44,-28,36,16,-16,-4,16,52,-16,16,64,-16,16,52,44,40,-32,28,16,-12,44,20,24,-40,16,-24,12,64,8,12,16,16,24,64,-56,36,8,24,24,16,-64,32,8,60,36,44,100,-8,44,-88,4,44,20,0,16,68,-12,16,28,20,16,-96,-36,44,-36,-44,20,-28,44,28,16,-4,68,-68,-16,16,28,24,16,60,-4,48,-80,-28,44,-100,-36,20,-112,-4,24,68,16,44,40,-44,32,100,36,16,68,44,24,-28,-32,16,-56,-32,12,12,44,24,-84,44,8,-44,-24,16,84,40,44,-112,-4,28,-32,8,60,-4,40,44,72,-44,12,112,16,36,-88,-40,24,56,-8,16,-20,-44,20,52,44,44,-84,44,20,76,28,16,64,-44,20,-56,-20,16,-32,0,64,92,24,44,4,-16,16,-24,16,64,48,-40,44,8,32,16,24,-24,16,-88,-24,44,84,40,12,-8,-8,68,-112,-8,32,28,-40,44,-76,-28,16,-88,-28,44,0,8,16,24,12,64,-96,24,16,-52,-8,48,-4,-44,24,88,-36,16,52,-44,16,-64,-28,44,4,24,64,76,44,36,20,-4,16,28,-44,36,-88,8,44,-36,-12,60,24,32,16,76,28,44,-72,8,44,-36,-40,16,-80,-8,16,20,-44,16,-112,0,44,-52,-32,44,84,-44,24,-108,-24,28,68,36,4,-68,-20,16,-108,20,40,-36,44,44,64,24,16,56,44,44,68,-44,28,44,44,36,64,-12,16,84,28,44,72,-44,40,88,8,44,-44,-32,44,24,-44,20,56,40,8,28,-44,32,-56,24,44,20,-20,16,-20,36,44,-12,0,68,-24,24,16,-92,0,16,-80,-44,36,-4,32,56,-64,0,44,56,44,32,-44,-44,44,68,40,4,-60,36,44,-72,-16,44,68,44,28,68,8,16,28,44,36,64,32,4,-12,-40,16,-16,-12,16,-24,44,36,112,-8,44,56,24,16,-36,20,56,-16,40,44,76,-32,4,64,8,16,-68,28,16,28,44,24,72,-8,44,-36,4,60,96,-12,44,48,-32,44,48,24,16,80,-28,44,104,32,40,-32,-16,16,72,4,16,56,8,16,16,-44,40,24,44,40,-88,36,44,-72,-4,16,28,-44,28,64,32,44,0,12,68,-92,24,16,-84,-36,8,-112,16,32,52,16,16,-44,-36,44,92,-20,16,80,-36,4,-40,0,16,-32,4,64,108,20,32,-92,4,16,88,-24,44,-92,-8,16,16,-44,20,84,-44,20,52,8,56,-28,-36,16,-20,-36,44,-100,20,16,-48,16,16,48,-44,40,76,24,16,-60,44,36,52,-44,36,64,-8,44,36,-24,56,-68,8,16,-48,-4,16,-60,-44,32,84,-32,44,-108,-20,40,-80,24,16,-16,-8,64,60,-36,44,-88,-24,16,80,-4,44,-32,44,36,84,36,8,100,12,16,4,32,56,-12,8,16,84,-40,36,-20,-20,60,76,-36,44,112,-16,36,-52,44,12,-28,4,64,-64,-12,16,28,-32,16,-104,32,28,-68,16,16,-100,4,44,-52,-44,44,32,-28,56,-4,-36,48,-112,4,40,80,-44,40,84,-44,8,44,-28,48,36,-44,44,-48,-4,52,-8,4,16,36,-36,16,88,-28,44,-12,-40,44,-100,-16,44,88,-24,16,16,32,56,76,-32,8,112,-16,16,-48,-32,16,92,-40,32,-112,8,44,12,-44,40,36,-4,64,0,-32,16,24,8,16,4,44,28,68,-16,44,-4,-8,16,-88,-4,16,-104,36,24,112,-16,20,-68,44,32,-32,24,56,-80,44,8,108,-8,44,112,-12,20,20,12,64,-28,8,64,-64,44,24,36,36,44,16,-36,16,84,-40,40,8,4,72,-84,32,12,92,12,16,-16,-40,16,-64,-4,44,60,44,8,-112,-8,28,-24,-24,60,-80,36,4,-52,12,16,-16,16,16,32,44,36,92,-8,44,-96,-20,16,-108,28,44,108,24,24,0,40,44,-68,-44,40,-56,4,16,60,-12,48,52,-12,16,-84,44,16,-4,16,16,-28,0,16,-48,24,16,-76,44,36,-72,-44,12,4,32,16,112,8,32,68,36,44,112,16,44,84,12,16,-76,-28,44,-52,-36,12,-104,8,16,68,20,16,-64,-32,12,0,-40,16,112,4,24,72,44,4,76,4,16,-28,-40,16,-60,16,16,100,-4,16,24,32,56,20,-4,68,40,28,52,-104,-28,44,88,20,16,108,-28,40,-44,-28,16,36,28,16,40,-32,16,48,36,44,-64,44,12,104,-8,16,80,40,44,-108,0,16,68,4,16,76,44,32,-88,40,28,-20,0,64,-80,-44,16,-28,-28,16,-8,32,56,76,-28,44,-20,-44,24,64,-28,44,84,16,16,112,8,20,-60,-4,16,-112,16,44,60,20,16,-60,-44,8,20,16,64,-104,36,28,-56,32,8,68,32,12,-20,44,32,4,-12,68,8,44,28,28,-12,64,-60,28,44,-52,-28,44,-84,36,8,-60,-36,4,56,-44,40,44,-20,56,-16,12,64,44,24,52,104,-24,16,4,-28,60,108,-4,16,76,-44,20,96,-16,44,-88,-40,40,-112,-16,24,52,36,44,104,12,44,4,36,16,-84,-44,8,-108,-4,44,108,-16,16,-20,-4,16,68,0,44,108,-16,44,-52,-4,16,56,44,8,48,-44,28,104,8,44,-4,28,60,-32,-4,16,0,16,64,-60,0,16,-40,-28,44,-88,-28,16,-76,-44,40,-60,36,4,-32,20,56,88,12,44,-48,-32,44,-100,8,44,-112,16,20,-8,28,60,-68,-44,12,36,-8,16,88,-40,16,12,-28,16,20,-36,16,60,8,52,-112,-12,40,-108,-12,44,-44,44,16,44,-28,16,-52,-44,20,20,-36,48,96,24,16,108,-28,16,80,8,44,84,-20,16,-44,44,36,0,24,64,-108,-24,40,-104,32,44,12,-36,52,-4,-20,16,64,0,16,-92,-32,16,76,-8,16,-100,-12,44,84,32,44,-76,-36,4,-68,32,44,-4,-44,20,72,44,44,-16,-44,16,-112,12,32,12,28,16,-100,36,40,-108,-24,32,-20,0,16,-60,40,4,-84,-8,16,-4,32,16,-28,44,36,48,-24,16,60,-8,16,76,12,44,-68,-28,44,4,-44,28,-24,-8,16,64,-32,4,-76,40,4,-60,8,16,56,-40,8,108,12,44,84,-36,44,76,8,44,-32,12,16,-68,-20,44,-56,16,16,4,-44,32,-36,-24,16,36,44,20,112,16,24,64,40,4,-12,-36,16,24,44,20,-112,-12,20,60,-44,12,52,44,12,44,16,60,64,-4,16,56,24,44,0,-4,16,8,-44,32,-112,8,28,-32,-44,24,24,-36,16,84,-8,16,32,4,64,-64,4,16,-24,-44,44,12,36,52,20,-16,64,36,-20,16,44,8,60,-76,36,4,32,-32,16,44,-8,60,60,-44,24,-80,44,12,84,36,12,4,-44,16,68,12,16,16,-16,64,-20,-20,16,-84,-36,12,16,40,44,-60,32,8,-92,-16,16,-92,4,44,28,-20,64,80,-44,16,-64,-40,44,64,-44,44,-92,-20,44,88,16,16,72,-44,32,48,44,24,-44,-24,44,12,-24,16,76,-40,44,80,20,44,-20,-32,16,60,44,24,92,-28,16,-8,-44,28,100,-24,44,16,4,68,-80,-36,4,16,0,68,-64,44,8,-8,-44,36,-68,24,44,8,-16,16,-12,44,24,-44,12,56,-56,44,8,88,-32,16,36,-44,24,104,24,16,-108,28,24,-80,-20,16,-4,8,16,28,-32,56,-36,44,20,80,-16,44,60,4,16,-80,4,16,36,20,16,48,44,36,-60,0,44,32,0,64,68,44,16,-104,16,16,-56,32,44,-52,-24,16,100,8,16,-68,32,4,60,40,44,52,-4,16,52,32,44,8,20,16,-52,-32,12,-32,-24,16,-32,-16,60,-32,44,20,108,4,16,72,44,36,76,44,16,88,28,44,64,36,4,-48,40,16,56,44,36,-112,-16,16,100,20,44,64,-20,44,-84,28,16,-76,-20,44,-68,44,20,-92,40,40,92,-12,44,-32,28,48,-8,-44,24,-44,-28,44,-40,-44,20,32,-16,16,96,0,16,112,4,32,16,44,28,76,-44,28,32,-28,16,-24,40,16,-80,44,20,-44,-12,16,80,-40,44,28,-8,64,-36,44,24,88,-40,44,-64,-8,44,100,12,44,60,44,44,-76,8,44,-64,44,4,-16,44,32,-24,20,16,-72,16,44,0,44,40,-88,40,40,-68,16,44,32,28,56,8,-36,16,-24,-20,60,-92,40,16,68,-32,44,-108,-24,44,44,-40,16,-40,-32,44,0,-16,16,8,44,40,-80,-44,4,28,-28,56,60,-44,8,24,44,44,48,-44,36,36,-4,16,44,-12,60,-48,-8,52,36,-44,36,80,40,4,-16,-36,16,8,44,32,92,-12,16,88,40,44,-12,-24,60,-4,4,16,-32,20,16,56,20,48,92,-8,16,-72,-12,16,-8,-4,16,96,8,44,32,44,24,-32,-20,16,-60,44,24,-4,-44,32,76,44,24,68,28,16,-96,4,16,8,-44,20,48,0,16,-64,-44,44,-28,-12,64,100,-36,32,-64,32,44,-48,44,32,68,-44,40,-112,-4,16,28,-16,16,76,0,16,-56,24,16,-48,20,44,-92,16,44,40,20,60,56,-20,48,52,12,56,76,-44,24,-32,44,32,-36,-8,16,-68,4,44,100,36,20,32,-44,40,-88,40,44,-76,20,44,-64,-16,44,-24,44,32,-60,-20,44,-32,-8,16,92,40,28,108,0,44,112,12,36,72,4,44,88,16,44,-12,-44,24,-20,40,16,112,-8,16,-28,4,16,-84,0,44,104,-4,44,40,-8,64,-112,8,24,108,28,20,-4,20,16,4,44,32,-36,-4,16,60,16,16,-72,24,44,4,8,16,112,-16,44,-32,-36,44,-76,-44,24,-44,-8,56,68,-44,8,104,0,16,-8,0,16,-24,-44,24,104,32,20,-72,-36,4,-28,16,60,12,12,16,24,0,16,56,12,52,72,44,24,0,-28,16,108,20,44,0,8,68,108,-24,16,-72,44,32,96,-32,44,-64,32,12,-68,0,16,-32,40,44,24,-24,60,52,4,16,-32,44,16,4,-24,16,92,-40,20,104,-28,44,-12,32,56,-112,12,24,-64,-4,16,-104,-20,44,12,24,64,64,-4,44,8,-16,64,-64,44,44,60,-36,4,-36,-44,36,112,-16,32,-64,40,4,0,44,44,-24,-4,64,104,36,32,36,-12,16,-48,-44,16,80,44,24,12,44,16,60,32,12,-8,-20,16,-72,-44,36,-40,-4,16,32,-24,16,52,-44,12,-92,8,44,-32,-28,52,64,-24,44,-4,-36,16,-40,28,44,-32,-12,16,-28,-20,60,72,20,16,-60,-24,44,96,40,32,88,36,16,68,-12,44,-4,12,68,20,32,56,-16,-44,36,-12,12,64,88,4,44,-48,36,44,-72,4,16,4,40,44,-36,32,44,84,20,44,32,-44,24,-112,-12,44,44,12,16,68,-8,44,16,-12,16,-64,44,32,-52,0,48,12,-8,68,-12,12,16,-108,28,28,-4,44,32,-12,8,68,48,-36,44,-76,-32,8,-60,44,32,28,20,64,-96,40,16,-64,-36,44,60,12,48,88,28,16,-88,40,32,-100,-36,28,-64,-16,16,32,32,48,16,8,16,-8,44,32,4,-32,16,20,-28,60,-96,-40,36,-100,-4,44,-60,-44,44,52,40,12,28,-28,16,36,36,16,-28,-44,44,56,-16,48,112,0,44,0,-36,48,36,-44,16,-20,-44,28,16,44,44,-80,-44,32,-104,-36,24,-24,-44,16,-68,-36,4,32,44,40,8,-32,16,-80,32,4,48,-24,48,44,44,28,24,-28,60,-92,-40,36,-104,-32,44,-20,44,36,96,4,44,20,-44,24,-20,16,64,-92,8,16,-68,0,44,112,12,20,28,-4,64,-4,-44,16,-4,40,16,-56,28,16,104,4,16,8,-12,68,84,44,16,56,-28,16,88,40,32,44,0,16,108,-24,36,88,-4,44,-48,44,24,-64,44,16,-48,4,16,80,44,16,-88,40,20,-4,-24,64,80,-32,8,-84,28,44,56,-32,44,60,-16,44,-100,36,20,80,-32,12,4,44,24,-76,0,44,-112,-4,40,-60,44,4,80,16,16,-40,32,16,8,36,48];
  function initSxScan(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var n = SX_CAR.length / 3, xs = [], ys = [], zs = [];
    for (var i = 0; i < n; i++) { xs.push(SX_CAR[i * 3] / 50); ys.push(SX_CAR[i * 3 + 1] / 50); zs.push(SX_CAR[i * 3 + 2] / 50); }
    var W = 0, H = 0, dpr = 1, running = false, visible = true;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
    }
    resize();
    window.addEventListener('resize', function () { resize(); if (prefersReduced) draw(0.9, 600); });

    function rgb() {
      // the panel is black in the bright theme and white in the dark theme
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [10, 10, 10] : [250, 250, 248];
    }
    var PITCH = 0.46, sp = Math.sin(PITCH), cp = Math.cos(PITCH);

    function draw(ang, t) {
      if (W < 2 || H < 2) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var c = rgb(), col = c[0] + ',' + c[1] + ',' + c[2];
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var cx = W / 2, cy = H * 0.7, sc = W * 0.14;

      function proj(x, y, z) {
        var xr = x * ca - y * sa, yr = x * sa + y * ca;
        return { x: cx + xr * sc, y: cy - (z * cp + yr * sp) * sc, d: yr * cp - z * sp };
      }

      // ground rings pulsing outward from the roof sensor
      ctx.lineWidth = 1;
      for (var k = 0; k < 3; k++) {
        var ph = ((t / 3200) + k / 3) % 1, r = 0.7 + ph * 2.2;
        ctx.beginPath();
        for (var s = 0; s <= 72; s++) {
          var a = (s / 72) * Math.PI * 2, p = proj(Math.cos(a) * r, Math.sin(a) * r, 0);
          if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(' + col + ',' + ((1 - ph) * 0.55).toFixed(3) + ')';
        ctx.stroke();
      }

      // car points: nearer = bigger/brighter, plus a bright scan band sweeping up and down
      var sweep = -0.1 + 1.95 * (0.5 - 0.5 * Math.cos(((t % 3400) / 3400) * Math.PI * 2));
      for (var q = 0; q < n; q++) {
        var p2 = proj(xs[q], ys[q], zs[q]);
        var near = 1 - (p2.d + 2.6) / 5.2; if (near < 0) near = 0; else if (near > 1) near = 1;
        var hit = Math.abs(zs[q] - sweep) < 0.13;
        var al = 0.14 + near * 0.42 + (hit ? 0.3 : 0); if (al > 1) al = 1;
        var sz = 1.2 + near * 1.3 + (hit ? 0.9 : 0);
        ctx.fillStyle = 'rgba(' + col + ',' + al.toFixed(2) + ')';
        ctx.fillRect(p2.x - sz / 2, p2.y - sz / 2, sz, sz);
      }

      // the AI label: a 3D bounding box that turns with the car, plus an upright tag
      var bx = 2.45, by = 1.1, bz = 1.78, corners = [];
      for (var u = 0; u < 8; u++) corners.push(proj((u & 1) ? bx : -bx, (u & 2) ? by : -by, (u & 4) ? bz : 0));
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(' + col + ',0.38)';
      ctx.beginPath();
      [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]].forEach(function (e) {
        ctx.moveTo(corners[e[0]].x, corners[e[0]].y); ctx.lineTo(corners[e[1]].x, corners[e[1]].y);
      });
      ctx.stroke();
      var top = proj(0, 0, bz), label = 'Car  98%';
      ctx.font = '600 12px Inter, sans-serif';
      var tw = ctx.measureText(label).width, lx = cx - (tw + 20) / 2, ly = top.y - 34;
      ctx.fillStyle = 'rgba(' + col + ',0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx, ly, tw + 20, 22, 11); else ctx.rect(lx, ly, tw + 20, 22);
      ctx.fill();
      ctx.fillStyle = (c[0] > 128) ? '#0b0b0d' : '#fafaf8';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + 10, ly + 11.5);
    }

    if (prefersReduced) {
      draw(0.9, 600);
      document.addEventListener('concave:themechange', function () { draw(0.9, 600); });
      return;
    }

    var ang = 0, t0 = performance.now();
    function tick(now) {
      if (running) requestAnimationFrame(tick);
      ang += 0.0075;                       // one full turn every ~14 s
      draw(ang, now - t0);
    }
    function start() { if (!running) { running = true; requestAnimationFrame(tick); } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) start(); else running = false; });
      }, { threshold: 0.05 }).observe(canvas);
    } else start();
  }

  // ── Moving diagrams for the pinned "Built-in automation" panel on the other
  // modality pages (same size / place as the 3D & LiDAR car). Each turns through
  // 360 degrees and carries AI-label chips, drawn in the panel's inverse colours. ──
  function sxPanelRGB() {
    // the panel is black in the bright theme and white in the dark theme
    return document.documentElement.getAttribute('data-theme') === 'dark' ? [10, 10, 10] : [250, 250, 248];
  }
  function sxProject(ang, pitch, cx, cy, sc) {
    var ca = Math.cos(ang), sa = Math.sin(ang), sp = Math.sin(pitch), cp = Math.cos(pitch);
    return function (x, y, z) {
      var xr = x * ca - y * sa, yr = x * sa + y * ca;
      return { x: cx + xr * sc, y: cy - (z * cp + yr * sp) * sc, d: yr * cp - z * sp };
    };
  }
  function sxChip(ctx, text, x, y, col, c, alpha) {
    ctx.font = '600 11.5px Inter, sans-serif';
    var w = ctx.measureText(text).width + 18, h = 21, lx = x - w / 2, ly = y - h / 2;
    ctx.fillStyle = 'rgba(' + col + ',' + (alpha == null ? 0.88 : alpha) + ')';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lx, ly, w, h, 10.5); else ctx.rect(lx, ly, w, h);
    ctx.fill();
    ctx.fillStyle = (c[0] > 128) ? '#0b0b0d' : '#fafaf8';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
  }
  function sxPoly(ctx, P, pts, z, col, fillA, strokeA, lw) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = P(pts[i][0], pts[i][1], z);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    if (fillA) { ctx.fillStyle = 'rgba(' + col + ',' + fillA + ')'; ctx.fill(); }
    if (strokeA) { ctx.lineWidth = lw || 1; ctx.strokeStyle = 'rgba(' + col + ',' + strokeA + ')'; ctx.stroke(); }
  }
  function sxRun(canvas, draw, minMs) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1, running = false;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
    }
    resize();
    function frame(ang, t) {
      if (W < 2 || H < 2) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var c = sxPanelRGB();
      draw(ctx, W, H, t, ang, c, c[0] + ',' + c[1] + ',' + c[2]);
    }
    window.addEventListener('resize', function () { resize(); if (prefersReduced) frame(0.9, 600); });
    if (prefersReduced) {
      frame(0.9, 600);
      document.addEventListener('concave:themechange', function () { frame(0.9, 600); });
      return;
    }
    var ang = 0, t0 = performance.now(), last = t0, minDt = minMs || 0;
    function tick(now) {
      if (running) requestAnimationFrame(tick);
      var dt = now - last;
      if (dt < minDt) return;              // optional frame-rate cap for the heavier diagrams
      last = now;
      ang += 0.0075 * Math.min(4, dt / 16.67);   // one full turn every ~14 s, whatever the frame rate
      frame(ang, now - t0);
    }
    function start() { if (!running) { running = true; requestAnimationFrame(tick); } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) start(); else running = false; });
      }, { threshold: 0.05 }).observe(canvas);
    } else start();
  }

  // IMAGES: a wireframe street scene (apartment block, tree, sedan, pedestrian, skyline, lamp post) modelled
  // in 3D, then flattened to one perspective line drawing that stands upright like a photo and turns 360
  // degrees. A scan beam sweeps it, then each segmented instance splits off as its own layer and settles back.
  var SX_IMG = null;
  function sxImgBuild() {
    var segs = [], K, i, j, curN = null;                                    // curN: outward normal of the facade being drawn (for culling hidden faces)
    function L(a, b, k) { segs.push([a[0], a[1], a[2], b[0], b[1], b[2], k || 0, curN]); }
    function poly(pts, k, close) { for (var q = 0; q < pts.length - (close ? 0 : 1); q++) L(pts[q], pts[(q + 1) % pts.length], k); }
    function box(x0, y0, z0, x1, y1, z1, k) {
      var c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) { L(c[e[0]], c[e[1]], k); });
    }
    function ellipsoid(cx, cy, cz, rx, ry, rz, k, rings, mer) {
      var seg = 12, m, r, s, p0, p1;
      for (r = 0; r < rings; r++) {
        var ph = -0.9 + (r + 0.5) * (2.0 / rings), pr = Math.cos(ph), pz = Math.sin(ph);
        for (s = 0; s < seg; s++) {
          var a0 = s / seg * 6.2832, a1 = (s + 1) / seg * 6.2832;
          L([cx + rx * pr * Math.cos(a0), cy + ry * pr * Math.sin(a0), cz + rz * pz], [cx + rx * pr * Math.cos(a1), cy + ry * pr * Math.sin(a1), cz + rz * pz], k);
        }
      }
      for (m = 0; m < mer; m++) {
        var th = m / mer * 6.2832;
        for (s = 0; s < 8; s++) {
          var q0 = -1.45 + s * (2.9 / 8), q1 = -1.45 + (s + 1) * (2.9 / 8);
          L([cx + rx * Math.cos(q0) * Math.cos(th), cy + ry * Math.cos(q0) * Math.sin(th), cz + rz * Math.sin(q0)], [cx + rx * Math.cos(q1) * Math.cos(th), cy + ry * Math.cos(q1) * Math.sin(th), cz + rz * Math.sin(q1)], k);
        }
      }
    }
    function wheel(cx, cy, cz, r, k) {                                   // axle along y
      var n = 14, s;
      for (s = 0; s < n; s++) {
        var a0 = s / n * 6.2832, a1 = (s + 1) / n * 6.2832;
        L([cx + r * Math.cos(a0), cy, cz + r * Math.sin(a0)], [cx + r * Math.cos(a1), cy, cz + r * Math.sin(a1)], k);
        L([cx + r * 0.55 * Math.cos(a0), cy, cz + r * 0.55 * Math.sin(a0)], [cx + r * 0.55 * Math.cos(a1), cy, cz + r * 0.55 * Math.sin(a1)], k);
        if (s % 3 === 0) L([cx + r * 0.55 * Math.cos(a0), cy, cz + r * 0.55 * Math.sin(a0)], [cx + r * Math.cos(a0), cy, cz + r * Math.sin(a0)], k);
      }
    }

    // ---- ground: kerb, pavement joints, road edge, dashed centre line, zebra crossing, and a disc outline
    L([-4, 0.25, 0], [4, 0.25, 0], 0); L([-4, 0.3, 0], [4, 0.3, 0], 0);                          // kerb
    L([-4, 2.0, 0], [4, 2.0, 0], 0); L([-4, 3.6, 0], [4, 3.6, 0], 0); L([-4, 3.65, 0], [4, 3.65, 0], 0);   // road edges and far kerb
    for (i = -8; i < 8; i++) L([i * 0.5 + 0.08, 1.14, 0], [i * 0.5 + 0.36, 1.14, 0], 0);       // dashed centre line
    for (i = -8; i <= 8; i++) L([i * 0.5, -3.0, 0], [i * 0.5, 0.25, 0], 0);                      // pavement joints
    for (j = 0; j < 6; j++) L([-4, -3.0 + j * 0.55, 0], [4, -3.0 + j * 0.55, 0], 0);
    // background street frontage: three taller blocks behind the pavement, each with a window grid
    function bgBlock(x0, x1, y0, y1, h, cols, rows) {
      box(x0, y0, 0, x1, y1, h, 0);
      var w = (x1 - x0) / cols, rh = (h - 0.5) / rows;
      for (var r = 0; r < rows; r++) for (var cI = 0; cI < cols; cI++) {
        var u0 = x0 + (cI + 0.2) * w, u1 = x0 + (cI + 0.8) * w, z0 = 0.35 + r * rh, z1 = z0 + rh * 0.55;
        poly([[u0, y1, z0], [u1, y1, z0], [u1, y1, z1], [u0, y1, z1]], 0, true);
      }
    }
    bgBlock(-3.9, -2.2, -4.6, -3.0, 3.6, 5, 9); bgBlock(-2.1, 0.0, -4.6, -3.0, 2.9, 6, 7); bgBlock(0.1, 2.0, -4.6, -3.0, 4.2, 5, 10); bgBlock(2.1, 3.9, -4.6, -3.0, 3.1, 5, 8);
    // lamp post
    L([-3.3, -0.2, 0], [-3.3, -0.2, 2.1], 0); L([-3.3, -0.2, 2.1], [-3.3, 0.15, 2.18], 0); box(-3.35, 0.1, 2.12, -3.25, 0.3, 2.2, 0); box(-3.35, -0.25, 0, -3.25, -0.15, 0.08, 0);
    for (i = 0; i < 5; i++) { var zx = 1.45 + i * 0.2; box(zx, 0.38, 0, zx + 0.11, 1.9, 0.001, 0); }  // zebra stripes

    // ---- K1 apartment block: facade piers, floor ledges, glazed windows with mullions, door, roof plant
    K = 1;
    var bx0 = -2.3, bx1 = -0.8, by0 = -1.55, by1 = -0.45, bh = 2.3;
    box(bx0, by0, 0, bx1, by1, bh, K); box(bx0 - 0.05, by0 - 0.05, bh, bx1 + 0.05, by1 + 0.05, bh + 0.09, K); box(bx0 + 0.45, by0 + 0.3, bh + 0.09, bx0 + 0.95, by0 + 0.7, bh + 0.3, K);
    function facade(fixed, alongX, c0, c1, cols, sign) {
      var rows = 6, w = (c1 - c0) / cols;
      for (var r = 0; r < rows; r++) {
        var z0 = 0.42 + r * 0.31, z1 = z0 + 0.2;
        for (var cI = 0; cI < cols; cI++) {
          var u0 = c0 + (cI + 0.2) * w, u1 = c0 + (cI + 0.8) * w, um = (u0 + u1) / 2;
          if (r === 0 && sign > 0 && alongX && cI === 1) continue;                // the door replaces a ground window
          var P0 = function (u, z) { return alongX ? [u, fixed, z] : [fixed, u, z]; };
          poly([P0(u0, z0), P0(u1, z0), P0(u1, z1), P0(u0, z1)], K, true); L(P0(um, z0), P0(um, z1), K);
        }
        L(alongX ? [c0, fixed, z1 + 0.05] : [fixed, c0, z1 + 0.05], alongX ? [c1, fixed, z1 + 0.05] : [fixed, c1, z1 + 0.05], K);   // floor ledge
      }
      for (var p = 0; p <= cols; p++) L(alongX ? [c0 + p * w, fixed, 0] : [fixed, c0 + p * w, 0], alongX ? [c0 + p * w, fixed, bh] : [fixed, c0 + p * w, bh], K);   // piers
    }
    curN = [0, 1]; facade(by1, true, bx0, bx1, 4, 1); curN = [0, -1]; facade(by0, true, bx0, bx1, 4, -1); curN = [-1, 0]; facade(bx0, false, by0, by1, 3, 1); curN = [1, 0]; facade(bx1, false, by0, by1, 3, -1);
    curN = [0, 1];
    var dx0 = bx0 + 0.45 + 0.375 * 0 + 0.0; dx0 = bx0 + 0.375 + 0.15;                                 // door on the road-facing side, under window column 2
    box(dx0, by1 - 0.001, 0, dx0 + 0.3, by1 + 0.001, 0.52, K); box(dx0 - 0.06, by1, 0.56, dx0 + 0.36, by1 + 0.2, 0.6, K); curN = null;

    // ---- K2 tree: flared, tapered trunk, a branching skeleton (limbs thin out level by level), and foliage
    // built from hundreds of small leaf outlines clustered around the twig tips, so the crown is organic
    K = 2;
    var tx = 1.5, ty = -0.95, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function ring6(cx, cy, z, r, wob) { var pts = []; for (var a6 = 0; a6 < 7; a6++) pts.push([cx + r * (1 + wob * Math.sin(a6 * 2.3)) * Math.cos(a6 / 7 * 6.2832), cy + r * (1 + wob * Math.sin(a6 * 2.3)) * Math.sin(a6 / 7 * 6.2832), z]); return pts; }
    var trunkRings = [[0, 0.16], [0.1, 0.115], [0.25, 0.095], [0.4, 0.082], [0.55, 0.07], [0.64, 0.062]], prevR = null;
    trunkRings.forEach(function (tr, ti) {
      var cxo = tx + 0.02 * Math.sin(tr[0] * 3), r6 = ring6(cxo, ty + 0.015 * Math.sin(tr[0] * 2), tr[0], tr[1], 0.12);
      poly(r6, K, true);
      if (prevR) for (var a7 = 0; a7 < 7; a7++) L(prevR[a7], r6[a7], K);
      prevR = r6;
    });
    for (i = 0; i < 5; i++) { var ra = i / 5 * 6.2832 + 0.4; L([tx + 0.14 * Math.cos(ra), ty + 0.14 * Math.sin(ra), 0], [tx + 0.3 * Math.cos(ra), ty + 0.3 * Math.sin(ra), 0], K); L([tx + 0.14 * Math.cos(ra), ty + 0.14 * Math.sin(ra), 0.02], [tx + 0.1 * Math.cos(ra + 0.2), ty + 0.1 * Math.sin(ra + 0.2), 0.3], K); }   // root flare
    function leafCluster(px2, py2, pz2, n, rad) {
      for (var li2 = 0; li2 < n; li2++) {
        var cx2 = px2 + (rnd() - 0.5) * rad * 2, cy2 = py2 + (rnd() - 0.5) * rad * 2, cz2 = pz2 + (rnd() - 0.4) * rad * 1.6;
        var th = rnd() * 6.2832, ph = (rnd() - 0.5) * 2.2, ux = Math.cos(th) * Math.cos(ph), uy = Math.sin(th) * Math.cos(ph), uz = Math.sin(ph);
        var wx = -Math.sin(th), wy = Math.cos(th), wz = 0.3 * (rnd() - 0.5), ln = 0.12 + rnd() * 0.07, wd = ln * 0.55;
        var A = [cx2 - ux * ln, cy2 - uy * ln, cz2 - uz * ln], Bp = [cx2 + wx * wd, cy2 + wy * wd, cz2 + wz * wd], C = [cx2 + ux * ln, cy2 + uy * ln, cz2 + uz * ln], Dp = [cx2 - wx * wd, cy2 - wy * wd, cz2 - wz * wd];
        poly([A, Bp, C, Dp], K, true); L(A, C, K);
      }
    }
    var tips = [];
    function limb(x0, y0, z0, dx, dy, dz, len, lev) {
      var x1 = x0 + dx * len, y1 = y0 + dy * len, z1 = z0 + dz * len;
      L([x0, y0, z0], [x1, y1, z1], K);
      if (lev <= 1) { var o = 0.035 - lev * 0.012; L([x0 + o, y0, z0], [x1 + o * 0.6, y1, z1], K); L([x0, y0 + o, z0], [x1, y1 + o * 0.6, z1], K); }
      if (lev === 2 || lev === 3) leafCluster(x1, y1, z1, 3, 0.2);
      if (lev >= 4) { tips.push([x1, y1, z1]); return; }
      var kids = 2;
      for (var q2 = 0; q2 < kids; q2++) {
        var az = q2 / kids * 6.2832 + rnd() * 1.1 + lev * 0.7, sp2 = 0.55 + rnd() * 0.3;
        var nx = dx * 0.4 + Math.cos(az) * sp2, ny = dy * 0.4 + Math.sin(az) * sp2, nz = dz * 0.5 + 0.55, nl = Math.hypot(nx, ny, nz);
        limb(x1, y1, z1, nx / nl, ny / nl, nz / nl, len * 0.74, lev + 1);
      }
    }
    for (j = 0; j < 6; j++) { var maz = j / 6 * 6.2832 + 0.3; limb(tx, ty, 0.5 + (j % 2) * 0.08, Math.cos(maz) * 0.62, Math.sin(maz) * 0.62, 0.78, 0.6, 1); }
    limb(tx, ty, 0.6, 0, 0, 1, 0.6, 1);
    tips.forEach(function (tp) { leafCluster(tp[0], tp[1], tp[2], 5, 0.22); });

    // ---- K3 sedan: a lofted body (cross-sections along the length, joined by longitudinal lines) with
    // tumblehome, glasshouse, shut lines, wheel arches, tyres and rims, mirrors, lamps, grille and plates
    K = 3;
    var cy = 0.72;
    var ZT = [[-0.95, 0.5], [-0.8, 0.56], [-0.55, 0.6], [-0.42, 0.76], [-0.28, 0.87], [0.14, 0.88], [0.32, 0.8], [0.5, 0.62], [0.7, 0.6], [0.88, 0.54], [0.95, 0.46]];
    function zTop(x) { for (var q = 0; q < ZT.length - 1; q++) if (x <= ZT[q + 1][0]) { var f = (x - ZT[q][0]) / (ZT[q + 1][0] - ZT[q][0]); f = f * f * (3 - 2 * f) * 0.5 + f * 0.5; return ZT[q][1] + (ZT[q + 1][1] - ZT[q][1]) * f; } return ZT[ZT.length - 1][1]; }
    var ST = [-0.95, -0.9, -0.8, -0.68, -0.55, -0.4, -0.25, -0.1, 0.05, 0.2, 0.35, 0.48, 0.6, 0.72, 0.84, 0.92, 0.95], secs = [];
    ST.forEach(function (x) {
      var zt = zTop(x), zbelt = Math.min(0.6, zt - 0.03), cab = zt > zbelt + 0.05, e = Math.abs(x) > 0.85 ? 1 - Math.pow((Math.abs(x) - 0.85) / 0.1, 2) * 0.2 : 1, hw = 0.4 * e;
      var bz = Math.abs(x) > 0.88 ? 0.22 : 0.17, hwr = cab ? 0.33 - Math.max(0, zt - 0.8) * 0.2 : hw * 0.8;
      var side = [[0.34 * e, bz], [hw + 0.005, 0.28], [hw + 0.012, 0.44], [hw, zbelt], [cab ? hwr : hw * 0.82, cab ? zt - 0.02 : zt - 0.012], [0, zt + (cab ? 0 : 0.014)]];
      secs.push(side);
    });
    function secPts(si) { var s2 = secs[si], pts = [], q; for (q = 0; q < 6; q++) pts.push([ST[si], cy - s2[q][0], s2[q][1]]); for (q = 4; q >= 1; q--) pts.push([ST[si], cy + s2[q][0], s2[q][1]]); pts.push([ST[si], cy + s2[0][0], s2[0][1]]); return pts; }
    var prevS = null;
    ST.forEach(function (x, si) {
      var pts = secPts(si);
      poly(pts, K, true);
      if (prevS) for (var q = 0; q < pts.length; q++) if (q !== 6 || true) L(prevS[q], pts[q], K);
      prevS = pts;
    });
    [1, -1].forEach(function (sd) {
      // shut lines, pillars, handles, mirrors
      [-0.38, -0.04, 0.3].forEach(function (dxl, di) { L([dxl, cy + sd * 0.41, 0.27], [dxl + (di === 1 ? 0 : 0.02), cy + sd * 0.405, 0.6], K); });
      L([-0.34, cy + sd * 0.412, 0.5], [-0.24, cy + sd * 0.412, 0.5], K); L([0.0, cy + sd * 0.412, 0.5], [0.1, cy + sd * 0.412, 0.5], K);
      L([0.28, cy + sd * 0.4, 0.62], [0.36, cy + sd * 0.49, 0.65], K); L([0.36, cy + sd * 0.49, 0.65], [0.4, cy + sd * 0.47, 0.6], K);
      L([-0.04, cy + sd * 0.36, 0.84], [-0.04, cy + sd * 0.395, 0.6], K);                        // B pillar
      // wheel arches: arcs over each wheel on the body side
      [-0.6, 0.6].forEach(function (wx2) {
        var n = 12, s2; for (s2 = 0; s2 < n; s2++) { var a0 = Math.PI * s2 / n, a1 = Math.PI * (s2 + 1) / n; L([wx2 + 0.255 * Math.cos(a0), cy + sd * 0.412, 0.21 + 0.255 * Math.sin(a0)], [wx2 + 0.255 * Math.cos(a1), cy + sd * 0.412, 0.21 + 0.255 * Math.sin(a1)], K); }
        // tyre (two walls and a tread), rim, hub and spokes
        var nn = 16, wy0 = cy + sd * 0.4, wy1 = cy + sd * 0.29;
        for (s2 = 0; s2 < nn; s2++) {
          var b0 = s2 / nn * 6.2832, b1 = (s2 + 1) / nn * 6.2832, c0 = Math.cos(b0), c1 = Math.cos(b1), s0 = Math.sin(b0), s1 = Math.sin(b1);
          L([wx2 + 0.21 * c0, wy0, 0.21 + 0.21 * s0], [wx2 + 0.21 * c1, wy0, 0.21 + 0.21 * s1], K); L([wx2 + 0.21 * c0, wy1, 0.21 + 0.21 * s0], [wx2 + 0.21 * c1, wy1, 0.21 + 0.21 * s1], K);
          L([wx2 + 0.135 * c0, wy0, 0.21 + 0.135 * s0], [wx2 + 0.135 * c1, wy0, 0.21 + 0.135 * s1], K); L([wx2 + 0.04 * c0, wy0, 0.21 + 0.04 * s0], [wx2 + 0.04 * c1, wy0, 0.21 + 0.04 * s1], K);
          if (s2 % 2 === 0) L([wx2 + 0.21 * c0, wy0, 0.21 + 0.21 * s0], [wx2 + 0.21 * c0, wy1, 0.21 + 0.21 * s0], K);
          if (s2 % 3 === 0) L([wx2 + 0.04 * c0, wy0, 0.21 + 0.04 * s0], [wx2 + 0.135 * c0, wy0, 0.21 + 0.135 * s0], K);
        }
      });
    });
    // front and rear: lamps, grille, bumper line, number plates
    [[0.955, 1], [-0.955, -1]].forEach(function (e2) {
      var fx = e2[0], sg = e2[1];
      [1, -1].forEach(function (sd) {
        poly([[fx, cy + sd * 0.34, 0.4], [fx, cy + sd * 0.2, 0.4], [fx, cy + sd * 0.2, 0.34], [fx, cy + sd * 0.34, 0.35]], K, true);
        L([fx, cy + sd * 0.27, 0.4], [fx, cy + sd * 0.27, 0.35], K);
      });
      poly([[fx, cy - 0.15, 0.3], [fx, cy + 0.15, 0.3], [fx, cy + 0.15, 0.23], [fx, cy - 0.15, 0.23]], K, true);
      for (i = 1; i < 4; i++) L([fx, cy - 0.15, 0.23 + i * 0.0175], [fx, cy + 0.15, 0.23 + i * 0.0175], K);
      poly([[fx, cy - 0.1, 0.2], [fx, cy + 0.1, 0.2], [fx, cy + 0.1, 0.15], [fx, cy - 0.1, 0.15]], K, true);
      L([fx - sg * 0.01, cy - 0.38, 0.2], [fx - sg * 0.01, cy + 0.38, 0.2], K);
    });
    // windscreen and rear screen frames
    L([0.33, cy - 0.3, 0.86], [0.33, cy + 0.3, 0.86], K); L([0.5, cy - 0.38, 0.62], [0.5, cy + 0.38, 0.62], K); L([-0.4, cy - 0.3, 0.8], [-0.4, cy + 0.3, 0.8], K); L([-0.55, cy - 0.36, 0.6], [-0.55, cy + 0.36, 0.6], K);

    // ---- K4 pedestrian: head, neck, torso, arms and legs as low-poly volumes
    K = 4;
    var px = 0.8, py = -0.1;
    ellipsoid(px, py, 0.93, 0.08, 0.08, 0.09, K, 3, 6);
    box(px - 0.03, py - 0.03, 0.82, px + 0.03, py + 0.03, 0.86, K);
    box(px - 0.12, py - 0.07, 0.5, px + 0.12, py + 0.07, 0.82, K);
    box(px - 0.18, py - 0.04, 0.5, px - 0.13, py + 0.04, 0.8, K); box(px + 0.13, py - 0.04, 0.5, px + 0.18, py + 0.04, 0.8, K);
    box(px - 0.1, py - 0.05, 0.04, px - 0.01, py + 0.05, 0.5, K); box(px + 0.01, py - 0.05, 0.04, px + 0.1, py + 0.05, 0.5, K);
    box(px - 0.11, py - 0.07, 0, px - 0.01, py + 0.09, 0.04, K); box(px + 0.01, py - 0.07, 0, px + 0.11, py + 0.09, 0.04, K);

    // spread the four instances out along the street so none hides another from the camera
    var SH = [0, 2.8, -4.0, -0.9, -0.5];
    segs.forEach(function (g) {
      if (g[6] === 4) { for (var m = 0; m < 6; m += 3) { g[m] = (g[m] - 0.8) * 1.22 + 0.8; g[m + 1] = (g[m + 1] + 0.1) * 1.22 - 0.1; g[m + 2] *= 1.22; } }   // a person is about 1.2 car-heights tall
      if (g[6]) { g[0] += SH[g[6]]; g[3] += SH[g[6]]; }
    });

    // per-instance extents (for the 3D box and the footprint)
    var ext = [null], q;
    for (q = 1; q <= 4; q++) ext.push([9, 9, 9, -9, -9, -9]);
    segs.forEach(function (s) {
      if (!s[6]) return;
      var e = ext[s[6]];
      for (var m = 0; m < 2; m++) {
        e[0] = Math.min(e[0], s[m * 3]); e[1] = Math.min(e[1], s[m * 3 + 1]); e[2] = Math.min(e[2], s[m * 3 + 2]);
        e[3] = Math.max(e[3], s[m * 3]); e[4] = Math.max(e[4], s[m * 3 + 1]); e[5] = Math.max(e[5], s[m * 3 + 2]);
      }
    });
    var off = [[0, 0]];
    for (q = 1; q <= 4; q++) { var ox = (ext[q][0] + ext[q][3]) / 2, oy = (ext[q][1] + ext[q][4]) / 2 + 0.2, ol = Math.hypot(ox, oy) || 1; off.push([ox / ol * 0.6, oy / ol * 0.6]); }
    return { segs: segs, ext: ext, off: off, names: [null, 'Building  89%', 'Tree  91%', 'Car  94%', 'Person  97%'] };
  }
  // Flatten the 3D scene into a single perspective line drawing (a wireframe "image"): one fixed camera on
  // the road side, perspective foreshortening, fitted and clipped to the frame. Each line keeps its
  // instance id so the instances can split off as their own layers.
  function sxImgFlatten(model) {
    var AN = 3.14159 + 0.14, PI2 = 0.3, ca = Math.cos(AN), sa = Math.sin(AN), cp = Math.cos(PI2), sp = Math.sin(PI2), D = 9;
    function pr(x, y, z) { var xr = x * ca - y * sa, yr = x * sa + y * ca, d = yr * cp - z * sp, s = D / (D + d); return [xr * s, (z * cp + yr * sp) * s, d]; }
    var raw = model.segs.filter(function (g) { return !g[7] || g[7][0] * -sa + g[7][1] * -ca > 0.02; }).map(function (g) { var a = pr(g[0], g[1], g[2]), b = pr(g[3], g[4], g[5]); return [a[0], a[1], b[0], b[1], g[6], (a[2] + b[2]) / 2]; });
    var mn = [9, 9], mx = [-9, -9];
    raw.forEach(function (r) { if (!r[4]) return; mn[0] = Math.min(mn[0], r[0], r[2]); mx[0] = Math.max(mx[0], r[0], r[2]); mn[1] = Math.min(mn[1], r[1], r[3]); mx[1] = Math.max(mx[1], r[1], r[3]); });
    var k = Math.min(3.0 / (mx[0] - mn[0]), 1.95 / (mx[1] - mn[1])), cx = (mx[0] + mn[0]) / 2, cy = (mx[1] + mn[1]) / 2;
    var HU = 1.7, HV = 1.15, out = [], ext = [null], q;
    for (q = 1; q <= 4; q++) ext.push([9, 9, -9, -9]);
    raw.forEach(function (r) {
      var x0 = (r[0] - cx) * k, y0 = (r[1] - cy) * k - 0.05, x1 = (r[2] - cx) * k, y1 = (r[3] - cy) * k - 0.05;
      var t0 = 0, t1 = 1, dx = x1 - x0, dy = y1 - y0, ok = true, ps = [-dx, dx, -dy, dy], qs = [x0 + HU, HU - x0, y0 + HV, HV - y0];     // Liang-Barsky clip to the frame
      for (var i = 0; i < 4; i++) {
        if (ps[i] === 0) { if (qs[i] < 0) ok = false; } else { var tt = qs[i] / ps[i]; if (ps[i] < 0) { if (tt > t1) ok = false; else if (tt > t0) t0 = tt; } else { if (tt < t0) ok = false; else if (tt < t1) t1 = tt; } }
      }
      if (!ok || t1 - t0 < 1e-4) return;
      var u0 = x0 + t0 * dx, v0 = y0 + t0 * dy, u1 = x0 + t1 * dx, v1 = y0 + t1 * dy;
      out.push([u0, v0, u1, v1, r[4], r[5]]);
      if (r[4]) { var e = ext[r[4]]; e[0] = Math.min(e[0], u0, u1); e[1] = Math.min(e[1], v0, v1); e[2] = Math.max(e[2], u0, u1); e[3] = Math.max(e[3], v0, v1); }
    });
    return { segs: out, ext: ext };
  }
  function sxDrawImages(ctx, W, H, t, ang, c, col) {
    if (!SX_IMG) { var mdl = sxImgBuild(); SX_IMG = sxImgFlatten(mdl); }
    var PITCH = 0.26, CP = Math.cos(PITCH), SP = Math.sin(PITCH), SA = Math.sin(ang), CA = Math.cos(ang);
    var cx0 = W / 2, cy0 = H * 0.86, sc = W * 0.19;
    // plane coords: u = width, v = height; layers are offset along y (depth)
    function P(u, y, v) { var z = v + 1.15, xr = u * CA - y * SA, yr = u * SA + y * CA; return { x: cx0 + xr * sc, y: cy0 - (z * CP + yr * SP) * sc, d: yr * CP - z * SP }; }
    function sm(x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); }
    var T = t % 9600, DY = [0, 0.55, 1.1, 1.65, 2.2], lift = [0, 0, 0, 0, 0], k;
    for (k = 1; k <= 4; k++) lift[k] = sm((T - (1500 + (k - 1) * 450)) / 900) - sm((T - (6400 + (4 - k) * 330)) / 900);
    function ly(kk) { return -DY[kk] * lift[kk]; }
    function lv(kk) { return 0.08 * kk * lift[kk]; }
    var beam = -1.75 + 3.5 * ((t % 2800) / 2800);
    var RECT = [[-1.7, -1.15], [1.7, -1.15], [1.7, 1.15], [-1.7, 1.15]];
    function frame(y, dv, alpha, dash, fillA) {
      ctx.beginPath();
      RECT.forEach(function (q, i) { var p = P(q[0], y, q[1] + dv); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.closePath();
      if (fillA) { ctx.fillStyle = 'rgba(' + col + ',' + fillA + ')'; ctx.fill(); }
      ctx.lineWidth = 1; ctx.setLineDash(dash || []); ctx.strokeStyle = 'rgba(' + col + ',' + alpha.toFixed(2) + ')'; ctx.stroke(); ctx.setLineDash([]);
    }
    frame(0, 0, 0.42, null, 0.03);
    for (k = 1; k <= 4; k++) if (lift[k] > 0.02) frame(ly(k), lv(k), 0.3 * lift[k], [3, 4]);

    // the wireframe image: lines bucketed by brightness, far lines fainter (perspective depth)
    var B = [], i;
    for (i = 0; i < 16; i++) B.push([]);
    SX_IMG.segs.forEach(function (s) {
      var kk = s[4], y = kk ? ly(kk) : 0, dv = kk ? lv(kk) : 0;
      var a = P(s[0], y, s[1] + dv), b = P(s[2], y, s[3] + dv);
      var near = 1 - ((a.d + b.d) / 2 + 2.6) / 5.2; near = near < 0 ? 0 : (near > 1 ? 1 : near);
      var fade = 1 - Math.min(1, Math.max(0, (s[5] + 3) / 9)) * 0.55, al;
      if (kk) al = (0.58 + 0.4 * lift[kk]) * (0.7 + near * 0.3) * fade;
      else al = 0.5 * (0.6 + near * 0.4) * fade;
      var mu = (s[0] + s[2]) / 2;
      if (Math.abs(mu - beam) < 0.06) al += 0.38;
      if (al > 0.999) al = 0.999;
      B[((al * 8) | 0) * 2 + (kk && lift[kk] > 0.3 ? 1 : 0)].push(a.x, a.y, b.x, b.y);
      if (kk && lift[kk] > 0.03) {                           // faint ghost left behind on the base image
        var a0 = P(s[0], 0, s[1]), b0 = P(s[2], 0, s[3]);
        B[((0.1 * Math.min(1, lift[kk] * 2) * 8) | 0) * 2].push(a0.x, a0.y, b0.x, b0.y);
      }
    });
    for (i = 0; i < 16; i++) {
      var arr = B[i]; if (!arr.length) continue;
      ctx.lineWidth = (i % 2) ? 1.3 : 0.9;
      ctx.strokeStyle = 'rgba(' + col + ',' + ((((i / 2) | 0) + 0.6) / 8.4).toFixed(2) + ')';
      ctx.beginPath();
      for (var m = 0; m < arr.length; m += 4) { ctx.moveTo(arr[m], arr[m + 1]); ctx.lineTo(arr[m + 2], arr[m + 3]); }
      ctx.stroke();
    }

    // a box around each lifted instance, on its own layer
    for (k = 1; k <= 4; k++) if (lift[k] > 0.4) {
      var ex = SX_IMG.ext[k], pad = 0.06, yy = ly(k), dv2 = lv(k);
      var cs = [[ex[0] - pad, ex[1] - pad], [ex[2] + pad, ex[1] - pad], [ex[2] + pad, ex[3] + pad], [ex[0] - pad, ex[3] + pad]];
      ctx.beginPath();
      cs.forEach(function (q, ii) { var p = P(q[0], yy, q[1] + dv2); if (ii === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.closePath(); ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(' + col + ',' + (0.85 * lift[k]).toFixed(2) + ')'; ctx.stroke();
    }
    ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(' + col + ',0.6)';
    ctx.fillText('instance segmentation  ·  4 objects', 10, H - 10);
  }

  // VIDEOS: a full point-cloud man walking while the view turns 360 degrees. Earlier steps of the
  // same person fade out behind (one object tracked across frames) and a 3D box carries the ID,
  // class and action labels. T-shirt, jeans, trainers; shaded so the body reads as solid.
  var SX_BODY = null;
  function sxPose(phi, ox) {
    var s = Math.sin, co = Math.cos, lean = 0.035;
    function leg(ph, sy) {
      var ang = 0.58 * s(ph), flex = 0.08 + 0.78 * Math.max(0, s(ph - 1.15));
      var hip = [ox - sy * 0.02 * s(phi), sy * 0.1 + 0.012 * s(phi), 0.92], knee = [hip[0] + 0.45 * s(ang), hip[1], hip[2] - 0.45 * co(ang)];
      var a2 = ang - flex, ankle = [knee[0] + 0.44 * s(a2), knee[1], knee[2] - 0.44 * co(a2)];
      var fa = a2 * 0.55 - 0.12;
      return { hip: hip, knee: knee, ankle: ankle, heel: [ankle[0] - 0.06, ankle[1], ankle[2] - 0.025], toe: [ankle[0] + 0.17 * co(fa), ankle[1], ankle[2] - 0.05 - 0.11 * s(Math.max(0, -fa))] };
    }
    function arm(ph, sy) {
      var ang = -0.55 * s(ph), flex = 0.28 + 0.32 * Math.max(0, s(ph + 1.2));
      var sh = [ox + lean + sy * 0.035 * s(phi), sy * 0.215, 1.4], el = [sh[0] + 0.3 * s(ang), sh[1] + sy * 0.02, sh[2] - 0.3 * co(ang)];
      var a2 = ang + flex, wr = [el[0] + 0.27 * s(a2), el[1], el[2] - 0.27 * co(a2)];
      var hx = s(a2 + 0.1), hz = -co(a2 + 0.1);
      return { sh: sh, el: el, wr: wr, hand: [wr[0] + 0.095 * hx, wr[1], wr[2] + 0.095 * hz] };
    }
    var bob = 0.014 * co(2 * phi);
    return { pelvis: [ox, 0, 0.92 + bob], neck: [ox + lean, 0, 1.47 + bob], head: [ox + lean + 0.03, 0, 1.7 + bob],
      L: leg(phi, 1), R: leg(phi + Math.PI, -1), AL: arm(phi + Math.PI, 1), AR: arm(phi, -1) };
  }
  // part: 0 shirt, 1 trousers, 2 skin, 3 shoes, 4 hair.  emit(x, y, z, part, nx, ny, nz) gets the outward normal too.
  function sxBodyPoints(ps, density, emit) {
    if (!SX_BODY) {
      SX_BODY = {};
      // evenly spread surface samples (golden-angle spiral) plus a little jitter so no pattern shows
      var hs = function (i, k) { var v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
      var mk = function (n) { var o = []; for (var i = 0; i < n; i++) o.push([Math.min(0.9999, Math.max(0, (i + 0.5 + (hs(i, 1) - 0.5) * 1.6) / n)), (i * 2.399963 + (hs(i, 2) - 0.5) * 1.1) % 6.283185]); return o; };
      var N = { torso: 1900, head: 700, neck: 90, uaL: 260, uaR: 260, faL: 200, faR: 200, hdL: 90, hdR: 90, thL: 720, thR: 720, shL: 560, shR: 560, ftL: 240, ftR: 240, pel: 300, nose: 40, earL: 30, earR: 30 };
      Object.keys(N).forEach(function (k) { SX_BODY[k] = mk(Math.max(24, Math.round(N[k] * 0.45))); });
    }
    function keep(i) { return density >= 1 || (((i * 2654435761) >>> 0) % 1000) < density * 1000; }
    function limb(A, B, r0, r1, rnd, part, bulge, splitAt) {
      var dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], len = Math.hypot(dx, dy, dz) || 1;
      var ux = dx / len, uy = dy / len, uz = dz / len;
      var hx = Math.abs(uz) < 0.9 ? 0 : 1, hz = Math.abs(uz) < 0.9 ? 1 : 0;
      var e1x = uy * hz, e1y = uz * hx - ux * hz, e1z = -uy * hx, el = Math.hypot(e1x, e1y, e1z) || 1;
      e1x /= el; e1y /= el; e1z /= el;
      var e2x = uy * e1z - uz * e1y, e2y = uz * e1x - ux * e1z, e2z = ux * e1y - uy * e1x;
      for (var i = 0; i < rnd.length; i++) {
        if (!keep(i)) continue;
        var u = rnd[i][0], th = rnd[i][1], r = r0 + (r1 - r0) * u + (bulge ? bulge * Math.sin(u * 3.1416) : 0);
        var ca = Math.cos(th), sa = Math.sin(th);
        var nx = ca * e1x + sa * e2x, ny = ca * e1y + sa * e2y, nz = ca * e1z + sa * e2z;
        emit(A[0] + dx * u + r * nx, A[1] + dy * u + r * ny, A[2] + dz * u + r * nz, splitAt != null ? (u < splitAt ? part : 2) : part, nx, ny, nz);
      }
    }
    function ell(c, rx, ry, rz, rnd, part, jaw) {
      for (var i = 0; i < rnd.length; i++) {
        if (!keep(i)) continue;
        var cph = 2 * rnd[i][0] - 1, sph = Math.sqrt(1 - cph * cph), th = rnd[i][1];
        var yy = ry * (jaw && cph < 0 ? 0.82 + 0.18 * (1 + cph) : 1);
        var x = rx * sph * Math.cos(th), y = yy * sph * Math.sin(th), z = rz * cph;
        if (jaw && x > 0.065 && ((Math.abs(Math.abs(y) - 0.036) < 0.012 && Math.abs(z - 0.028) < 0.011) ||           // eyes
            (Math.abs(y) < 0.026 && Math.abs(z + 0.052) < 0.008))) continue;                                           // mouth
        var gx = x / (rx * rx), gy = y / (yy * yy), gz = z / (rz * rz), gl = Math.hypot(gx, gy, gz) || 1;
        emit(c[0] + x, c[1] + y, c[2] + z, typeof part === 'function' ? part(x, y, z) : part, gx / gl, gy / gl, gz / gl);
      }
    }
    // torso: broad shoulders, chest in front, narrower waist, slightly fuller hips
    var T = SX_BODY.torso, pz = ps.pelvis[2], nz = ps.neck[2], px = ps.pelvis[0], lx = ps.neck[0] - ps.pelvis[0];
    for (var i = 0; i < T.length; i++) {
      if (!keep(i)) continue;
      var u = T[i][0], th = T[i][1], cs = Math.cos(th), sn = Math.sin(th);
      var ry = u < 0.28 ? 0.158 - 0.02 * (u / 0.28) : (u < 0.62 ? 0.138 + 0.06 * ((u - 0.28) / 0.34) : 0.198 + 0.02 * ((u - 0.62) / 0.38));
      var rxF = u < 0.28 ? 0.1 + 0.005 * (u / 0.28) : (u < 0.62 ? 0.095 + 0.04 * ((u - 0.28) / 0.34) : 0.135 - 0.05 * ((u - 0.62) / 0.38));
      var rxB = u < 0.28 ? 0.122 - 0.024 * (u / 0.28) : (u < 0.62 ? 0.098 + 0.006 * ((u - 0.28) / 0.34) : 0.104 - 0.025 * ((u - 0.62) / 0.38));
      var rx = cs >= 0 ? rxF : rxB, gx = cs / rx, gy = sn / ry, gl = Math.hypot(gx, gy) || 1;
      emit(px + lx * u * u + rx * cs, ps.pelvis[1] + ry * sn, pz + (nz - pz) * u, u < 0.15 ? 1 : 0, gx / gl, gy / gl, 0);
    }
    ell([px, 0, pz + 0.04], 0.112, 0.168, 0.1, SX_BODY.pel, 1);
    // head: squarer jaw, short hair, nose, ears, eyes and mouth left as dark gaps
    var hc = ps.head;
    ell(hc, 0.1, 0.086, 0.125, SX_BODY.head, function (x, y, z) { return (z > 0.05 && x < 0.05) || z > 0.092 ? 4 : 2; }, true);
    ell([hc[0] + 0.1, 0, hc[2] - 0.014], 0.026, 0.017, 0.036, SX_BODY.nose, 2);
    ell([hc[0] - 0.005, 0.089, hc[2] - 0.005], 0.014, 0.01, 0.029, SX_BODY.earL, 2);
    ell([hc[0] - 0.005, -0.089, hc[2] - 0.005], 0.014, 0.01, 0.029, SX_BODY.earR, 2);
    limb([ps.neck[0] - 0.005, 0, ps.neck[2] - 0.02], [ps.head[0] - 0.01, 0, ps.head[2] - 0.1], 0.066, 0.056, SX_BODY.neck, 2);
    limb(ps.AL.sh, ps.AL.el, 0.066, 0.05, SX_BODY.uaL, 0, 0, 0.55); limb(ps.AR.sh, ps.AR.el, 0.066, 0.05, SX_BODY.uaR, 0, 0, 0.55);
    limb(ps.AL.el, ps.AL.wr, 0.048, 0.034, SX_BODY.faL, 2); limb(ps.AR.el, ps.AR.wr, 0.048, 0.034, SX_BODY.faR, 2);
    limb(ps.AL.wr, ps.AL.hand, 0.036, 0.026, SX_BODY.hdL, 2); limb(ps.AR.wr, ps.AR.hand, 0.036, 0.026, SX_BODY.hdR, 2);
    limb(ps.L.hip, ps.L.knee, 0.104, 0.068, SX_BODY.thL, 1); limb(ps.R.hip, ps.R.knee, 0.104, 0.068, SX_BODY.thR, 1);
    limb(ps.L.knee, ps.L.ankle, 0.064, 0.04, SX_BODY.shL, 1, 0.014); limb(ps.R.knee, ps.R.ankle, 0.064, 0.04, SX_BODY.shR, 1, 0.014);
    limb(ps.L.heel, ps.L.toe, 0.056, 0.04, SX_BODY.ftL, 3); limb(ps.R.heel, ps.R.toe, 0.056, 0.04, SX_BODY.ftR, 3);
  }
  function sxDrawVideo(ctx, W, H, t, ang, c, col) {
    var PITCH = 0.3, CP = Math.cos(PITCH), SP = Math.sin(PITCH), SA = Math.sin(ang), CA = Math.cos(ang);
    var cx0 = W / 2, cy0 = H * 0.8, sc = W * 0.2;
    function P(x, y, z) { var xr = x * CA - y * SA, yr = x * SA + y * CA; return { x: cx0 + xr * sc, y: cy0 - (z * CP + yr * SP) * sc, d: yr * CP - z * SP }; }
    var phi = t / 320, pose = sxPose(phi, 0);
    var PART_A = [0.88, 0.7, 1, 0.95, 0.9], SZ = [1.3, 1.8, 2.5];

    // ground path covered so far (dotted)
    ctx.lineWidth = 1.2; ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(' + col + ',0.45)';
    var g0 = P(-1.9, 0, 0), g1 = P(0.1, 0, 0);
    ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.stroke(); ctx.setLineDash([]);

    // points are grouped by (brightness, size) and drawn as a few big paths: much cheaper than one fillRect each
    var B = [], bi;
    for (bi = 0; bi < 24; bi++) B.push([]);
    function flush() {
      for (var a = 0; a < 8; a++) for (var s2 = 0; s2 < 3; s2++) {
        var arr = B[a * 3 + s2]; if (!arr.length) continue;
        var sz = SZ[s2], h = sz / 2;
        ctx.fillStyle = 'rgba(' + col + ',' + ((a + 0.6) / 8.4).toFixed(2) + ')';
        ctx.beginPath();
        for (var q = 0; q < arr.length; q += 2) ctx.rect(arr[q] - h, arr[q + 1] - h, sz, sz);
        ctx.fill();
        arr.length = 0;
      }
    }
    function cloud(ps, density, alphaMul, sweep) {
      sxBodyPoints(ps, density, function (x, y, z, part, nx, ny, nz) {
        var xr = x * CA - y * SA, yr = x * SA + y * CA, d = yr * CP - z * SP;
        var near = 1 - (d + 2.4) / 4.8; if (near < 0) near = 0; else if (near > 1) near = 1;
        // surfaces facing the viewer are bright, those facing away fade, so the figure reads as solid
        var f = -(nx * SA + ny * CA) * CP + nz * SP, shade = f > 0 ? 0.3 + 0.7 * f : 0.1 + 0.2 * (1 + f);
        var hit = sweep != null && Math.abs(z - sweep) < 0.06;
        var al = (0.1 + near * 0.3 + shade * 0.62 + (hit ? 0.25 : 0)) * PART_A[part] * alphaMul; if (al > 0.999) al = 0.999;
        var ai = (al * 8) | 0, si = hit ? 2 : (near > 0.55 ? 1 : 0);
        B[ai * 3 + si].push(cx0 + xr * sc, cy0 - (z * CP + yr * SP) * sc);
      });
      flush();
    }
    // earlier steps of the same person, thinning out behind it
    for (var k = 3; k >= 1; k--) cloud(sxPose(phi - k * 0.95, -0.58 * k), 0.24, 0.6 / (k * 0.85 + 0.35), null);
    var sweep = -0.05 + 1.95 * (0.5 - 0.5 * Math.cos(((t % 3400) / 3400) * Math.PI * 2));
    cloud(pose, 1, 1, sweep);

    // tracking box + labels
    var bx = 0.62, by = 0.36, bz = 1.92, cn = [];
    for (var u2 = 0; u2 < 8; u2++) cn.push(P((u2 & 1) ? bx : -bx, (u2 & 2) ? by : -by, (u2 & 4) ? bz : 0));
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(' + col + ',0.38)'; ctx.beginPath();
    [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]].forEach(function (e) { ctx.moveTo(cn[e[0]].x, cn[e[0]].y); ctx.lineTo(cn[e[1]].x, cn[e[1]].y); });
    ctx.stroke();
    var top = P(0, 0, bz);
    sxChip(ctx, 'ID 07  Person 96%', Math.min(W - 70, Math.max(70, top.x)), Math.max(14, top.y - 16), col, c, 0.85);
    sxChip(ctx, 'Walking  94%', 50, H - 36, col, c, 0.85);
    ctx.font = '600 10.5px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(' + col + ',0.6)';
    ctx.fillText('00:0' + (((t / 1000) % 9.9)).toFixed(1) + '  \u00b7  24 fps  \u00b7  object tracking', 10, H - 12);
  }

  // AUDIO: a live 3D spectrogram of a two-person conversation, turning 360 degrees. Bars dance only
  // while someone is actually speaking, each voice has its own spectral shape, and the "Speaker A" /
  // "Speaker B" tag shows up only on the turn that speaker is taking. A diarization track in front
  // marks who spoke when.
  var SX_TURNS = [[0, 3.4, 0], [3.4, 7.0, 1], [7.0, 9.4, 0], [9.4, 12.4, 1]], SX_LOOP = 12.4;
  function sxDrawAudio(ctx, W, H, t, ang, c, col) {
    var P = sxProject(ang, 0.5, W / 2, H * 0.74, W * 0.14);
    var NT = 64, NF = 10, XM = 2.4, YM = 0.95, now = (t / 1000) % SX_LOOP;
    function turnAt(sec) { for (var i = 0; i < SX_TURNS.length; i++) if (sec >= SX_TURNS[i][0] && sec <= SX_TURNS[i][1]) return i; return -1; }
    function xOf(sec) { return -XM + 2 * XM * (sec / SX_LOOP); }
    var cur = turnAt(now);
    var voice = [function (j) { return Math.exp(-Math.pow((j - 2) / 2.3, 2)) + 0.18; }, function (j) { return Math.exp(-Math.pow((j - 5.5) / 2.4, 2)) + 0.18; }];
    function hash(i, j) { var v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return v - Math.floor(v); }
    var bars = [];
    for (var i = 0; i < NT; i++) {
      var sec = (i + 0.5) / NT * SX_LOOP, ti = turnAt(sec);
      var env = 0, spk = 0;
      if (ti >= 0) {
        var tt = sec - SX_TURNS[ti][0], len = SX_TURNS[ti][1] - SX_TURNS[ti][0], edge = Math.min(1, tt / 0.06 + 0.35, (len - tt) / 0.06 + 0.35);
        env = (0.5 + 0.5 * Math.abs(Math.sin(tt * 7.3 + ti * 1.9))) * (0.65 + 0.35 * Math.abs(Math.sin(tt * 2.1 + 1))) * edge;
        spk = SX_TURNS[ti][2];
      }
      for (var j = 0; j < NF; j++) {
        var base = ti >= 0 ? env * voice[spk](j) * (0.6 + 0.4 * hash(i, j)) * 1.45 : 0.04 + 0.02 * hash(i, j);
        var live = ti >= 0 && ti === cur;                                                // this bar belongs to the turn being spoken right now
        var hgt;
        if (live) hgt = base * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * (0.009 + 0.0011 * j) + i * 2.1 + j * 1.3))) + 0.03;
        else if (sec <= now) hgt = base * 0.55 + 0.03;                                    // already played: a fixed record
        else hgt = base * 0.22 + 0.02;                                                    // still to come: faint stub
        var x = -XM + 2 * XM * i / (NT - 1), y = -YM + 2 * YM * j / (NF - 1);
        var b0 = P(x, y, 0), b1 = P(x, y, hgt);
        bars.push({ b: b0, tp: b1, d: b0.d, live: live, played: sec <= now });
      }
    }
    // floor outline
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(' + col + ',0.22)';
    ctx.beginPath(); [[-XM - 0.15, -YM - 0.2], [XM + 0.15, -YM - 0.2], [XM + 0.15, YM + 0.2], [-XM - 0.15, YM + 0.2]].forEach(function (q, i2) { var p = P(q[0], q[1], 0); if (i2 === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.closePath(); ctx.stroke();
    bars.sort(function (p1, p2) { return p2.d - p1.d; });
    bars.forEach(function (br) {
      var near = Math.max(0, Math.min(1, 1 - (br.d + 2.8) / 5.6));
      var al = br.live ? 0.5 + near * 0.5 : (br.played ? 0.22 + near * 0.3 : 0.08 + near * 0.1);
      ctx.lineWidth = (br.live ? 2.6 : 2) + near * 1.1;
      ctx.strokeStyle = 'rgba(' + col + ',' + Math.min(1, al).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(br.b.x, br.b.y); ctx.lineTo(br.tp.x, br.tp.y); ctx.stroke();
      if (br.live) { ctx.fillStyle = 'rgba(' + col + ',' + Math.min(1, al + 0.1).toFixed(2) + ')'; ctx.fillRect(br.tp.x - 1.6, br.tp.y - 1.6, 3.2, 3.2); }
    });

    // the tag of whoever is speaking right now (nobody during a pause)
    if (cur >= 0) {
      var tn2 = SX_TURNS[cur], mid = P(xOf((tn2[0] + tn2[1]) / 2), 0, 1.75), fade = Math.min(1, (now - tn2[0]) / 0.08 + 0.4);
      sxChip(ctx, tn2[2] === 0 ? 'Speaker A' : 'Speaker B', Math.min(W - 48, Math.max(48, mid.x)), Math.max(16, mid.y - 14), col, c, 0.9 * Math.max(0, Math.min(1, fade)));
    }
    ctx.font = '600 10.5px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(' + col + ',0.6)';
    ctx.fillText('00:' + (now < 10 ? '0' : '') + now.toFixed(1) + '  \u00b7  speaker diarization  \u00b7  2 speakers', 10, H - 12);
  }

  // TEXT: a real document (a short service agreement) standing upright and turning a full 360 degrees
  // (the far side reads mirrored and dimmer, like paper seen from behind). A scan beam reads across it, then each named entity (date, person, organisation,
  // place, amount) lifts off the page into its own layer with a box and a confidence tag, linked
  // together, and settles back. Text is drawn as real glyphs mapped onto the page plane.
  var SX_TXT = {
    title: 'Service Agreement',
    lines: [
      [['This agreement is made on ', 0], ['14 March 2026', 3], [' between', 0]],
      [['Priya Sharma', 1], [', acting for ', 0], ['Northwind Logistics', 2], [', and the', 0]],
      [['supplier. The supplier will deliver labeled data from', 0]],
      [['the ', 0], ['Austin, Texas', 5], [' office for a fixed fee of ', 0], ['$48,500', 4], [',', 0]],
      [['payable within ', 0], ['30 days', 6], [' of each invoice, with a ', 0], ['2% late fee', 7], ['.', 0]],
      [['Both parties agree to keep all personal information', 0]],
      [['confidential and to review any disputed labels', 0]],
      [['before final delivery. Contact ', 0], ['legal@northwind.com', 8]],
      [['Reference ', 0], ['AGR-2026-0412', 9], [', effective immediately.', 0]]
    ]
  };
  function sxDrawText(ctx, W, H, t, ang, c, col) {
    var sway = ang;                                  // a full 360-degree revolution
    var PITCH = 0.2, CP = Math.cos(PITCH), SP = Math.sin(PITCH), SA = Math.sin(sway), CA = Math.cos(sway);
    var cx0 = W / 2, cy0 = H * 0.9, sc = W * 0.2;
    var bg = c[0] > 128 ? 'rgba(10,10,10,0.92)' : 'rgba(250,250,248,0.92)';
    function P(u, y, v) { var z = v + 1.15, xr = u * CA - y * SA, yr = u * SA + y * CA; return { x: cx0 + xr * sc, y: cy0 - (z * CP + yr * SP) * sc, d: yr * CP - z * SP }; }
    function sm(x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); }
    var T = t % 10400, DY = [0, 0.22, 0.44, 0.66, 0.88, 1.1, 1.32, 1.54, 1.76, 1.98], lift = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], k;
    for (k = 1; k <= 9; k++) lift[k] = sm((T - (1500 + (k - 1) * 330)) / 900) - sm((T - (7200 + (9 - k) * 220)) / 900);
    function ly(kk) { return -DY[kk] * lift[kk]; }
    function lv(kk) { return 0.035 * kk * lift[kk]; }
    var beam = -1.75 + 3.5 * ((t % 2800) / 2800);
    var RECT = [[-1.7, -1.15], [1.7, -1.15], [1.7, 1.15], [-1.7, 1.15]];

    function frame(y, dv, alpha, dash, fillA) {
      ctx.beginPath();
      RECT.forEach(function (q, i) { var p = P(q[0], y, q[1] + dv); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.closePath();
      if (fillA) { ctx.fillStyle = 'rgba(' + col + ',' + fillA + ')'; ctx.fill(); }
      ctx.lineWidth = 1; ctx.setLineDash(dash || []); ctx.strokeStyle = 'rgba(' + col + ',' + alpha.toFixed(2) + ')'; ctx.stroke(); ctx.setLineDash([]);
    }
    // run fn with the context mapped onto the page plane (1 local unit = 0.01 page unit, y down), shifted by (y, dv)
    function onPlane(y, dv, fn) {
      ctx.save();
      ctx.transform(CA * sc / 100, -SA * SP * sc / 100, 0, CP * sc / 100, cx0 - y * SA * sc, cy0 - (1.15 + dv) * CP * sc - y * CA * SP * sc);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var fc = Math.max(0, Math.min(1, CA * 3 + 0.5)); ctx.globalAlpha = 0.42 + 0.58 * fc * fc * (3 - 2 * fc);
      fn(); ctx.restore();
    }

    frame(0, 0, 0.42, null, 0.04);

    // lay the document out in plane units (measured in the plane's own font)
    var D = SX_TXT, ents = [null, null, null, null, null, null, null, null, null, null], rows = [], LS = 0.178, TOP = 0.56;
    onPlane(0, 0, function () {
      ctx.font = '500 9.5px Inter, sans-serif';
      D.lines.forEach(function (ln, li) {
        var x = -145, row = [];
        ln.forEach(function (sg) {
          var w = ctx.measureText(sg[0]).width;
          row.push({ s: sg[0], k: sg[1], x: x, w: w });
          if (sg[1]) ents[sg[1]] = { u0: (x - 2) / 100, u1: (x + w + 2) / 100, v: TOP - li * LS };
          x += w;
        });
        rows.push(row);
      });
    });

    // the page itself: title, rule and plain text
    onPlane(0, 0, function () {
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillStyle = 'rgba(' + col + ',0.92)'; ctx.fillText(D.title, -145, -0.9 * 100);
      ctx.fillStyle = 'rgba(' + col + ',0.28)'; ctx.fillRect(-145, -0.73 * 100, 290, 1);
      ctx.font = '500 9.5px Inter, sans-serif';
      rows.forEach(function (row, li) {
        var V = -(TOP - li * LS) * 100, near = Math.abs((TOP - li * LS) - 0) < 99;
        row.forEach(function (sg) {
          var beamHit = Math.abs((sg.x + sg.w / 2) / 100 - beam) < 0.22;
          if (sg.k) {
            var gl = lift[sg.k];
            ctx.fillStyle = 'rgba(' + col + ',' + (0.13 * (1 - gl) + (beamHit ? 0.18 : 0)).toFixed(2) + ')';
            ctx.fillRect(sg.x - 2, V - 7, sg.w + 4, 14);
            ctx.fillStyle = 'rgba(' + col + ',' + (0.95 - 0.7 * gl).toFixed(2) + ')';
          } else ctx.fillStyle = 'rgba(' + col + ',' + (beamHit ? 0.95 : 0.6) + ')';
          ctx.fillText(sg.s, sg.x, V);
        });
      });
      // scan beam: a thin vertical line across the page
      ctx.fillStyle = 'rgba(' + col + ',0.5)'; ctx.fillRect(beam * 100 - 0.5, -1.05 * 100, 1, 2.1 * 100);
    });

    // tethers, lifted cards (real text on their own layer), boxes
    var cen = {};
    for (k = 1; k <= 9; k++) if (lift[k] > 0.03) {
      var e = ents[k], mu = (e.u0 + e.u1) / 2;
      (function (kk, ee) {
        var sg = null; rows.forEach(function (row) { row.forEach(function (s) { if (s.k === kk) sg = s; }); });
        onPlane(ly(kk), lv(kk), function () {
          var V = -ee.v * 100;
          ctx.fillStyle = bg; ctx.fillRect(sg.x - 4, V - 8, sg.w + 8, 16);
          ctx.font = '500 9.5px Inter, sans-serif';
          ctx.fillStyle = 'rgba(' + col + ',' + (0.98 * Math.min(1, lift[kk] * 2)).toFixed(2) + ')'; ctx.fillText(sg.s, sg.x, V);
          ctx.lineWidth = 1.2 / (sc / 100); ctx.strokeStyle = 'rgba(' + col + ',' + (0.9 * lift[kk]).toFixed(2) + ')';
          ctx.strokeRect(sg.x - 4, V - 8, sg.w + 8, 16);
        });
      })(k, e);
      var cp = P(mu, ly(k), e.v + lv(k)); cen[k] = { x: cp.x, y: cp.y, a: lift[k] };
    }
    // two relation chains linking the lifted entities: a solid one and a dashed one, each with its own travelling dot
    var CHAINS = [[1, 2, 5, 8], [3, 4, 6, 7, 9]];
    CHAINS.forEach(function (ch, ci) {
      var a = 1, i, pts = [];
      for (i = 0; i < ch.length; i++) { if (!cen[ch[i]]) { a = 0; break; } a = Math.min(a, cen[ch[i]].a); pts.push(cen[ch[i]]); }
      if (a < 0.05) return;
      ctx.lineWidth = 1.3; ctx.setLineDash(ci ? [4, 4] : []); ctx.strokeStyle = 'rgba(' + col + ',' + (0.6 * a).toFixed(2) + ')';
      ctx.beginPath(); pts.forEach(function (p, j) { if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke(); ctx.setLineDash([]);
      var sg2 = ((t / 1100 + ci * 0.9) % (pts.length - 1)), si = Math.floor(sg2), sf = sg2 - si;
      ctx.fillStyle = 'rgba(' + col + ',' + (0.95 * a).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(pts[si].x + (pts[si + 1].x - pts[si].x) * sf, pts[si].y + (pts[si + 1].y - pts[si].y) * sf, 2.8, 0, 6.283); ctx.fill();
    });

    ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(' + col + ',0.6)';
    ctx.fillText('named entity recognition  ·  9 entities  ·  2 relation chains', 10, H - 10);
  }

  function initModalityVideos() {
    var rows = document.querySelectorAll('.modalities-row');
    rows.forEach(function (row) {
      var vids = row.querySelectorAll('video');
      if (!vids.length) return;
      var visible = false;
      function sync() {
        vids.forEach(function (v) {
          if (visible && !prefersReduced && v.offsetParent !== null) {
            var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
          } else v.pause();
        });
      }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }, { threshold: 0.1 }).observe(row);
      } else { visible = true; sync(); }
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    });
  }

  function initLoopPanel() {
    var panel = document.querySelector('.loop-panel');
    if (!panel) return;
    var svg = document.getElementById('loopPanelSvg');
    var path = document.getElementById('loopRectPath');
    var dot = document.getElementById('loopPanelDot');
    if (!svg || !path || !dot) return;

    var cards = [];
    for (var n = 1; n <= 10; n++) {
      cards.push(panel.querySelector('.loop-card[data-loop-card="' + n + '"]'));
    }

    // Clockwise from the top-left corner: 3 cards along the top, 2 down
    // the right, 3 along the bottom (encountered right-to-left), 2 up the
    // left — matches the numbered 1→10 loop order and the grid-template-
    // areas frame in platform.css.
    var EDGE_CARDS = { top: [0, 1, 2], right: [3, 4], bottom: [5, 6, 7], left: [8, 9] };
    var INSET = 40; // fallback only, used if a card is ever missing

    // Measuring individual card boxes (the previous approach) can only
    // ever be as fresh as the last time it happened to run — if the grid's
    // internal row split shifts afterward for any reason, the cards move
    // but nothing says so. The CSS Grid track sizes themselves don't have
    // that problem: getComputedStyle().gridTemplateColumns/Rows returns
    // the browser's own resolved (fr-units-already-solved) pixel sizes for
    // the CURRENT layout, synchronously, every time it's read — it's the
    // authoritative source layout is built from, not a derived snapshot
    // that can go stale. Reading it directly instead of re-deriving it
    // from child boxes removes the whole class of bug.
    var grid = panel.querySelector('.loop-card-grid');

    function trackCenter(sizes, gap, index) {
      var pos = 0;
      for (var i = 0; i < index; i++) pos += sizes[i] + gap;
      return pos + sizes[index] / 2;
    }

    var geo = {};

    function measure() {
      var w = panel.clientWidth, h = panel.clientHeight;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

      var x0, y0, x1, y1;
      var cs = grid && window.getComputedStyle(grid);
      var cols = cs && cs.gridTemplateColumns.split(' ').filter(Boolean).map(parseFloat);
      var rows = cs && cs.gridTemplateRows.split(' ').filter(Boolean).map(parseFloat);
      var colGap = cs ? (parseFloat(cs.columnGap) || 0) : 0;
      var rowGap = cs ? (parseFloat(cs.rowGap) || 0) : 0;

      if (cols && rows && cols.length === 5 && rows.length === 4 &&
          cols.every(isFinite) && rows.every(isFinite)) {
        var gridRect = grid.getBoundingClientRect();
        var svgRect = svg.getBoundingClientRect();
        var gx = gridRect.left - svgRect.left, gy = gridRect.top - svgRect.top;
        x0 = gx + trackCenter(cols, colGap, 0);
        x1 = gx + trackCenter(cols, colGap, cols.length - 1);
        y0 = gy + trackCenter(rows, rowGap, 0);
        y1 = gy + trackCenter(rows, rowGap, rows.length - 1);
      } else {
        // Mobile (<900px) collapses to a single column and hides this SVG
        // entirely, so cols.length won't be 5 there — this fallback only
        // ever draws into a hidden element in that case.
        x0 = INSET; y0 = INSET; x1 = w - INSET; y1 = h - INSET;
      }

      path.setAttribute('d', 'M' + x0 + ',' + y0 + ' L' + x1 + ',' + y0 + ' L' + x1 + ',' + y1 + ' L' + x0 + ',' + y1 + ' Z');
      geo.x0 = x0; geo.y0 = y0; geo.rectW = x1 - x0; geo.rectH = y1 - y0;
      geo.perimeter = 2 * (geo.rectW + geo.rectH);
    }

    // Position + which edge/local-fraction a given 0..1 lap progress lands
    // on, walking top → right → bottom → left.
    function pointAt(progress) {
      var d = progress * geo.perimeter, w = geo.rectW, h = geo.rectH;
      if (d < w) return { x: geo.x0 + d, y: geo.y0, edge: 'top', t: d / w };
      d -= w;
      if (d < h) return { x: geo.x0 + w, y: geo.y0 + d, edge: 'right', t: d / h };
      d -= h;
      if (d < w) return { x: geo.x0 + w - d, y: geo.y0 + h, edge: 'bottom', t: d / w };
      d -= w;
      return { x: geo.x0, y: geo.y0 + h - d, edge: 'left', t: d / h };
    }

    function cardIndexAt(progress) {
      var p = pointAt(progress);
      var list = EDGE_CARDS[p.edge];
      return list[Math.min(list.length - 1, Math.floor(p.t * list.length))];
    }

    measure();
    window.addEventListener('resize', measure, { passive: true });
    // measure() now reads the grid's own resolved track sizes fresh every
    // time it runs, so it's always correct at the moment it's called —
    // but something still has to CALL it again whenever a reflow changes
    // those track sizes (the Inter webfont swapping in for the fallback
    // font and rewrapping card body text, most likely; a reveal transition
    // or late image can too). ResizeObserver re-measures on any real
    // layout change, whatever the cause, instead of guessing which
    // one-off events to listen for.
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { measure(); });
      ro.observe(panel);
      if (grid) ro.observe(grid);
      cards.forEach(function (c) { if (c) ro.observe(c); });
    } else {
      window.addEventListener('load', measure);
      setTimeout(measure, 500);
      setTimeout(measure, 1500);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }

    var start = pointAt(0);
    dot.setAttribute('cx', start.x);
    dot.setAttribute('cy', start.y);

    if (prefersReduced) return;

    var DUR = 9000;
    var current = -1;
    function frame(ts) {
      requestAnimationFrame(frame);
      var progress = (ts % DUR) / DUR;
      var pt = pointAt(progress);
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);

      var idx = cardIndexAt(progress);
      if (idx !== current) {
        if (cards[current]) cards[current].classList.remove('is-loop-active');
        if (cards[idx]) cards[idx].classList.add('is-loop-active');
        current = idx;
      }
    }
    requestAnimationFrame(frame);
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

  /* ── Version page "Resolutions" radial diagram: 6 nodes bound by
     spokes to a fixed center hub. The whole ring orbits the hub at a
     slow constant angular speed (continuous revolution), while each
     node's on-screen size cycles through a 6-step rank order — one
     node is biggest, the next is next-biggest, and so on — smoothly
     interpolated frame-to-frame so the "biggest" rank visibly travels
     one step around the ring every cycle, forever. Canvas draws the
     spokes + node dots each frame; the number/title labels are the
     real DOM nodes already in the page, repositioned via transform to
     track the canvas-computed coordinates, so text stays crisp and
     theme-aware instead of being rasterized. */
  function initResolutionOrbit(root) {
    if (!root) return;
    var canvas = root.querySelector('.resolution-orbit-canvas');
    var nodeEls = root.querySelectorAll('.resolution-orbit-node');
    if (!canvas || !nodeEls.length) return;
    var ctx = canvas.getContext('2d');
    var N = nodeEls.length;
    var numEls = [], titleEls = [], descEls = [];
    nodeEls.forEach(function (el) {
      numEls.push(el.querySelector('.resolution-orbit-num'));
      titleEls.push(el.querySelector('.resolution-orbit-title'));
      descEls.push(el.querySelector('.resolution-orbit-desc'));
    });

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    /* Diameters as fractions of the container's own min dimension, same
       for orbitR, so the ring radius and the node sizes it must clear
       scale together — no overlap at any breakpoint without per-size
       tuning. Sized to hold a full title + short description inside
       each circle (not just a number/title label). */
    var MAX_DIAM_FACTOR = 0.32, MIN_DIAM_FACTOR = 0.175;
    var ORBIT_FACTOR = 0.32;
    var TOP_ANGLE = -Math.PI / 2;

    var W, H, cx, cy, orbitR, maxSize, minSize;
    function resize() {
      var rect = root.getBoundingClientRect();
      W = canvas.width = rect.width;
      H = canvas.height = rect.height;
      cx = W / 2;
      cy = H / 2;
      var minWH = Math.min(W, H);
      orbitR = minWH * ORBIT_FACTOR;
      maxSize = minWH * MAX_DIAM_FACTOR;
      minSize = minWH * MIN_DIAM_FACTOR;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw(t) {
      if (W < 2 || H < 2) return;
      ctx.clearRect(0, 0, W, H);
      var rgb = fgRGB();
      var rotation = t * 0.00022;

      for (var i = 0; i < N; i++) {
        var angle = (i / N) * Math.PI * 2 - Math.PI / 2 + rotation;
        var x = cx + Math.cos(angle) * orbitR;
        var y = cy + Math.sin(angle) * orbitR;

        /* Size is driven purely by position on the ring, not by which
           node this is — 1 at the top, 0 at the bottom, continuously
           interpolated as the ring rotates, so whichever node is
           currently nearest the top is always the biggest and whoever
           is at the bottom is always the smallest. */
        var topness = (Math.cos(angle - TOP_ANGLE) + 1) / 2;
        var size = minSize + (maxSize - minSize) * topness;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();

        var el = nodeEls[i];
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        /* Padding is set here in px, scaled to this node's own `size`,
           rather than in CSS as a percentage — a percentage padding on
           an absolutely-positioned element resolves against its
           positioned ANCESTOR's width (the whole diagram), not its own
           size, so every node was getting the same fixed padding
           regardless of how big or small it currently is. */
        el.style.padding = (size * 0.1) + 'px';
        el.style.transform = 'translate(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px)';
        var titleSize = Math.max(10.5, size * 0.085);
        var descSize = Math.max(7.5, size * 0.044);
        numEls[i].style.fontSize = Math.max(8, size * 0.07) + 'px';
        titleEls[i].style.fontSize = titleSize + 'px';
        descEls[i].style.fontSize = descSize + 'px';
        /* Max-height tracks this node's own current size (not a flat
           line count), so the description reveals more as the node
           grows toward the top of the ring and clips tighter while
           it's small near the bottom — consistent with "biggest at
           top, smallest at bottom" rather than fighting it. */
        descEls[i].style.maxHeight = (size * 0.4) + 'px';
      }
    }

    if (prefersReduced) {
      draw(0);
      document.addEventListener('concave:themechange', function () { draw(0); });
      return;
    }

    function tick(ts) {
      requestAnimationFrame(tick);
      draw(ts);
    }
    requestAnimationFrame(tick);
  }

  /* ── MLOps page "Integration Depth": 8 nodes sliding straight in
     toward the center hub and back out again — not orbiting it. Each
     node keeps a fixed angle WHILE it's mid-cycle, but the instant it
     bottoms out (closest to the hub, smallest, barely visible) it
     gets reassigned a fresh random angle before growing back out —
     so which direction each feature appears in keeps reshuffling over
     time, without ever reading as rotation, since the reassignment
     only happens while the node is too small to notice the jump.
     Radius and size still share the same phase per node, so a node
     is small exactly when it's closest to the hub and big exactly
     when it's farthest out: that coupling is what guarantees nodes
     never collide, not luck — near the hub they're tiny (plenty of
     room even as spokes converge), and out at the rim they're big
     but far enough apart to clear (checked against the actual
     geometry, see the factors below — the geometry holds for ANY
     angle assignment, not just the original evenly-spaced one, so
     reassigning angles never breaks the no-overlap guarantee).
     Each node's cycle has its own independent frequency + phase so
     they're never all in step. DOM writes are rounded to whole
     pixels and skipped when unchanged, which is what actually fixes
     the "text shuddering" — sub-pixel width/font-size writes every
     frame were re-wrapping the title text every time, reading as
     a shaky flicker. Hovering the diagram freezes the shared clock. */
  function initFeatureOrbit(root) {
    if (!root) return;
    var canvas = root.querySelector('.feature-orbit-canvas');
    var nodeEls = root.querySelectorAll('.feature-orbit-node');
    if (!canvas || !nodeEls.length) return;
    var ctx = canvas.getContext('2d');
    var N = nodeEls.length;
    var titleEls = [], descEls = [], hovered = [];
    nodeEls.forEach(function (el, idx) {
      titleEls.push(el.querySelector('.feature-orbit-title'));
      descEls.push(el.querySelector('.feature-orbit-desc'));
      hovered.push(false);
      el.addEventListener('mouseenter', function () { hovered[idx] = true; });
      el.addEventListener('mouseleave', function () { hovered[idx] = false; });
    });

    function fgRGB() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? [250, 250, 248] : [10, 10, 10];
    }

    /* Geometry check (as a fraction of the diagram's min dimension):
       near point — radius 0.14, node diameter 0.09 (half=0.045) — two
       adjacent nodes both fully "in" sit 0.14*2*sin(22.5°)=0.107 apart
       center-to-center, needing only their two 0.045 half-diameters
       (0.09) to clear, a 19% margin. Far point — radius 0.37, diameter
       0.23 (half=0.115) — adjacent centers sit 0.37*2*sin(22.5°)=0.283
       apart, needing 0.23, an 18% margin. Both ends hold. */
    var MIN_RADIUS_FACTOR = 0.14, MAX_RADIUS_FACTOR = 0.37;
    var MIN_DIAM_FACTOR = 0.09, MAX_DIAM_FACTOR = 0.23;

    function rand(min, max) { return min + Math.random() * (max - min); }

    /* N fixed, evenly-spaced slot angles — these never change. Each
       node owns a `slot` index into this array rather than an angle
       directly; reshuffling means swapping two nodes' slot values,
       which can never produce two nodes at the same (or a closer-
       than-45°) angle, since it's always a permutation of the same N
       slots. That's what keeps the no-overlap geometry proof valid
       after any number of reshuffles. */
    var slotAngles = [];
    for (var s = 0; s < N; s++) slotAngles.push((s / N) * Math.PI * 2);

    var nodes = [];
    for (var i = 0; i < N; i++) {
      nodes.push({
        slot: i,
        freq: rand(1 / 9000, 1 / 4200),
        phase: rand(0, Math.PI * 2),
        armed: true,
        /* Each node keeps its OWN clock instead of all sharing one —
           hovering a single circle only stops that node's clock from
           advancing (frozen in place, mid-motion), every other node's
           clock keeps ticking exactly as if nothing happened. */
        localT: 0
      });
    }

    var W, H, cx, cy, minRadius, maxRadius, minSize, maxSize;
    function resize() {
      var rect = root.getBoundingClientRect();
      W = canvas.width = rect.width;
      H = canvas.height = rect.height;
      cx = W / 2;
      cy = H / 2;
      var minWH = Math.min(W, H);
      minRadius = minWH * MIN_RADIUS_FACTOR;
      maxRadius = minWH * MAX_RADIUS_FACTOR;
      minSize = minWH * MIN_DIAM_FACTOR;
      maxSize = minWH * MAX_DIAM_FACTOR;
    }
    resize();
    window.addEventListener('resize', resize);

    /* A tapered zigzag: offset magnitude follows sin(t·π) so it's
       exactly 0 at both ends (cleanly meeting the hub and the node)
       and alternates sides segment to segment. */
    function strokeZigzag(x0, y0, x1, y1, rgb, alpha) {
      var dx = x1 - x0, dy = y1 - y0;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len, ny = dx / len;
      var segments = 6;
      var jitter = Math.min(16, len * 0.05);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (var s = 1; s < segments; s++) {
        var t = s / segments;
        var px = x0 + dx * t, py = y0 + dy * t;
        var sign = (s % 2 === 0) ? 1 : -1;
        var mag = jitter * Math.sin(Math.PI * t);
        px += nx * mag * sign;
        py += ny * mag * sign;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
      ctx.lineWidth = 1.2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    var lastSize = new Array(N).fill(-1);

    function draw(dt) {
      if (W < 2 || H < 2) return;
      ctx.clearRect(0, 0, W, H);
      var rgb = fgRGB();

      var sizeTs = new Array(N);
      for (var i = 0; i < N; i++) {
        if (!hovered[i]) nodes[i].localT += dt;
        sizeTs[i] = (Math.sin(nodes[i].localT * nodes[i].freq + nodes[i].phase) + 1) / 2;
      }

      /* Reshuffle pass: only swap two nodes' slots when BOTH are near
         their smallest point at once (armed + under the threshold),
         so the jump is imperceptible for both sides, not just the one
         that triggered it. A hovered node is excluded entirely — it
         should stay exactly where the cursor found it, not swap away
         underneath the pointer. An odd one left over just waits for
         next time. */
      var bottomedOut = [];
      for (var j = 0; j < N; j++) {
        if (hovered[j]) continue;
        if (nodes[j].armed && sizeTs[j] < 0.06) bottomedOut.push(j);
        else if (sizeTs[j] > 0.3) nodes[j].armed = true;
      }
      while (bottomedOut.length >= 2) {
        var a = bottomedOut.pop();
        var b = bottomedOut.pop();
        var tmpSlot = nodes[a].slot;
        nodes[a].slot = nodes[b].slot;
        nodes[b].slot = tmpSlot;
        nodes[a].armed = false;
        nodes[b].armed = false;
      }

      for (var i = 0; i < N; i++) {
        var n = nodes[i];
        var sizeT = sizeTs[i];
        var angle = slotAngles[n.slot];
        var radius = minRadius + (maxRadius - minRadius) * sizeT;
        var size = Math.round(minSize + (maxSize - minSize) * sizeT);
        var x = cx + Math.cos(angle) * radius;
        var y = cy + Math.sin(angle) * radius;

        strokeZigzag(cx, cy, x, y, rgb, 0.16);

        var el = nodeEls[i];
        el.style.transform = 'translate(' + Math.round(x - size / 2) + 'px,' + Math.round(y - size / 2) + 'px)';

        if (size !== lastSize[i]) {
          lastSize[i] = size;
          el.style.width = size + 'px';
          el.style.height = size + 'px';
          el.style.padding = Math.round(size * 0.1) + 'px';
          titleEls[i].style.fontSize = Math.round(Math.max(9.5, size * 0.08)) + 'px';

          /* Description stays collapsed until the node is at least 35%
             of the way through its size cycle, then grows in —
             "small" only ever shows the heading, "big" reveals the
             rest. */
          var descT = Math.max(0, (sizeT - 0.35) / 0.65);
          descEls[i].style.fontSize = Math.round(Math.max(7.5, size * 0.042)) + 'px';
          descEls[i].style.maxHeight = Math.round(descT * size * 0.42) + 'px';
          descEls[i].style.opacity = descT.toFixed(2);
        }
      }
    }

    if (prefersReduced) {
      draw(0);
      document.addEventListener('concave:themechange', function () { draw(0); });
      return;
    }

    var lastTs = null;
    function tick(ts) {
      requestAnimationFrame(tick);
      if (lastTs === null) lastTs = ts;
      var dt = ts - lastTs;
      lastTs = ts;
      draw(dt);
    }
    requestAnimationFrame(tick);
  }

  function initHoverPlayVideos() {
    var videos = document.querySelectorAll('.task-bento-tile video, .task-bento-mosaic-tile video');
    videos.forEach(function (video) {
      var tile = video.closest('.task-bento-tile, .task-bento-mosaic-tile');
      if (!tile) return;
      tile.addEventListener('mouseenter', function () { video.play(); });
      tile.addEventListener('mouseleave', function () {
        video.pause();
        video.currentTime = 0;
      });
    });
  }

  function init() {
    initLayerScroll();
    initEngineScroll();
    initGovernScroll();
    initPacketWireframe(document.getElementById('bestCanvas'));
    initSxScan(document.getElementById('sxWire'));
    sxRun(document.getElementById('sxWireImg'), sxDrawImages, 33);
    sxRun(document.getElementById('sxWireVid'), sxDrawVideo, 33);
    sxRun(document.getElementById('sxWireAud'), sxDrawAudio, 33);
    sxRun(document.getElementById('sxWireTxt'), sxDrawText, 33);
    initNeuralSphere(document.getElementById('transformCanvas'));
    initGeoDome(document.getElementById('labelCanvas'));
    initGeoSphereFull(document.getElementById('versionCanvas'));
    initResolutionOrbit(document.querySelector('.resolution-orbit'));
    initFeatureOrbit(document.querySelector('.feature-orbit'));
    initFeedbackTorus(document.getElementById('observeCanvas'));
    initAuditChain(document.getElementById('governCanvas'));
    initInfinityWireframe(document.getElementById('infinityCanvas'));
    initImgCarousel();
    initModalityVideos();
    initSplitScroll();
    initLoopPanel();
    initOverviewScroll();
    initTaskSwitch();
    initHoverPlayVideos();
    initFaq();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
