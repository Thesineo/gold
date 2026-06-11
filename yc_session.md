# Concave AI — YC Application Session Notes
**Date:** June 2026 | **Domain:** theconcaveai.com

---

## What We Built

This document captures the full product build session for **Concave AI**, an expert data annotation and AI training data company targeting high-stakes industries in India and globally.

---

## The Company in One Line

> *Training data that actually improves your model.* Expert RLHF, NLP annotation, GenAI evaluation, and image labelling — with published quality scores on every delivery.

---

## Product Overview

**Concave AI** is a full-stack AI training data provider. We are not a crowd-labelling marketplace. We are a quality system: every batch goes through automated pre-screening, peer review, and expert sign-off, with Cohen's kappa reported on delivery.

### Core differentiators
- **0.72+ Cohen's kappa** on every delivery — quality is measurable, not claimed
- **60% faster** than pure-manual annotation via RLAIF pipeline
- **3-tier QA** — automated + peer + expert on every batch
- **8-week** average time from brief to first model improvement seen
- India-native data at scale: auto-rickshaws, unstructured intersections, multilingual NLP, monsoon conditions — datasets that Western providers cannot supply

---

## Website Architecture (26 pages, all hand-coded)

### Service Pages
| Page | Description |
|------|-------------|
| RLHF / Preference Data | Human preference ranking for LLM alignment |
| NLP Annotation | Named entity, intent, sentiment at scale |
| Supervised Fine-Tuning | Task-specific training data construction |
| Sycophancy Detection | Annotating model sycophancy for RLHF correction |
| Hallucination Evaluation | Factuality scoring and grounding checks |
| Red-Teaming | Adversarial prompt generation and safety annotation |
| Code RLHF | Correctness + style preference for code models |
| Image / Video Annotation | Bounding boxes, segmentation, keypoints |
| Synthetic Data | Controlled data generation + validation |
| RAG Evaluation | Retrieval quality and answer faithfulness scoring |

### Industry Verticals
- **Automotive / ADAS** — Indian road annotation: vehicles, auto-rickshaws, two-wheelers, pedestrians, lane markings. Live annotation demo with aerial Mumbai intersection footage (AV3.png), 16 annotated objects, κ = 0.89
- **Agriculture** — Crop/weed detection, field condition classification
- **Finance** — Document intelligence, KYC, fraud signal annotation
- **Legal** — Contract clause extraction, case outcome annotation
- **GenAI** — Evaluation, red-teaming, preference data for foundation models

### Content & Authority
7 long-form technical blogs published:
1. *Cohen's Kappa: The Metric That Proves Your Annotation Quality*
2. *Sycophancy in RLHF — and How Better Data Fixes It*
3. *How to Train an AI Model*
4. *Why Multimodal Data Pipelines Fail*
5. *Synthetic Data vs Real Data*
6. *ADAS Data Annotation — Indian Road Conditions*
7. *Satellite Image Annotation for Geospatial AI*

4 published case studies:
- Computer Vision for Autonomous Vehicles (Indian roads)
- RLHF for Agentic Systems
- FinTech Document Intelligence
- AgTech Crop/Weed Detection

---

## Technical Build — What Was Done in This Session

### 1. Blog content expansion
Added two new blog pages to the resources hub with custom filter taxonomy:
- `blog-adas-data-annotation.html` — tagged: Computer Vision, Quality, Industry, Automotive
- `blog-satellite-image-annotation.html` — tagged: Computer Vision, Quality, Geospatial

Added new filter buttons to `resources.html`: **Automotive** and **Geospatial** (joining existing: RLHF / NLP / Quality / Computer Vision / Industry / AI Training / Multimodal / Synthetic Data).

Both URLs added to `sitemap.xml`.

### 2. CTA button visibility fix (all blog pages)
**Problem:** Blog CTA buttons ("Request a Free Audit →") were rendering as blank — orange text on orange background, invisible to users.

**Root cause:** CSS specificity conflict. `.article-wrap a` (specificity 0-2-1) was overriding `.article-cta-btn` (0-1-0), colouring button text with the accent orange instead of white.

**Fix:** Added `:not(.article-cta-btn)` pseudo-class to the anchor override selector across all 6 affected blog files. This preserves inline text-link styling while restoring white button text.

Files fixed: `blog-sycophancy-rlhf.html`, `blog-how-to-train-ai-model.html`, `blog-synthetic-data-vs-real-data.html`, `blog-adas-data-annotation.html`, `blog-satellite-image-annotation.html`, `blog-multimodal-data-why-it-fails.html`, `blog-cohens-kappa.html`.

### 3. Contact form — direct webhook integration
**Problem:** Form was showing "Something went wrong" for a long time. Root cause was that FormSubmit.co's AJAX endpoint requires email activation before it accepts submissions; the account was never activated, so every submission silently failed.

**Fix:** Removed all third-party form services (FormSubmit.co, Web3Forms). Form now POSTs JSON directly to the Make.com webhook already embedded in the page.

```javascript
// Direct Make.com webhook — no middleman
fetch('https://hook.eu2.make.com/acsgifyuq7e8nlwih51eol3vd7wcmg77', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
```

Services checkboxes are collected and combined into a comma-separated string before sending. Success state hides the form and shows a confirmation. No redirect, no third-party dependency.

### 4. Automotive annotation demo — aerial image update
Replaced the hero image on `industry-automative.html` and `resources.html` ADAS card from a stock tech photo to `images/AV3.png` — an actual drone/aerial shot of a dense Mumbai intersection with live traffic.

Updated the interactive annotation demo overlay to match the aerial perspective:
- **16 annotated objects** across 5 classes
- Boxes repositioned from a street-level perspective to an overhead bird's-eye perspective
- Vehicles (×7), Auto-Rickshaws (×3), Two-Wheelers (×3), Pedestrians (×2), Lane Divider (×1)
- Boxes spread across the full image width (left 4% to right 76%) to match actual vehicle positions
- Image filter adjusted: `brightness(1.12) contrast(1.08) saturate(1.12)` for clarity
- Sidebar class counts and footer object count updated to match (16 total, κ = 0.89)

---

## Tech Stack

- Pure HTML/CSS/JS — no framework, no build step
- Custom CSS design system: `--ink`, `--paper`, `--accent (#bc5113)`, `--accent2`, `--muted`, `--border`
- Typography: DM Serif Display (headings) + Space Grotesk (body) + Space Mono (data/code)
- Form-to-CRM: Make.com webhook (direct JSON POST)
- Hosted at: **theconcaveai.com**

---

## Metrics Shown on Site

| Metric | Value |
|--------|-------|
| Annotation accuracy (kappa) | 0.72+ on every delivery |
| Speed vs manual | 60% faster (RLAIF pipeline) |
| QA layers | 3-tier (automated + peer + expert) |
| Time to first model improvement | ~8 weeks from brief |

---

## What This Demonstrates for YC

1. **Speed of execution** — Full-featured 26-page site built and iterated in production, shipping real content and fixing real bugs in the same session.
2. **Domain specificity** — Not a generic annotation tool. Deep vertical focus: Indian road data for ADAS, satellite imagery, multilingual NLP, finance docs. The market Western competitors are not serving.
3. **Quality as a moat** — Cohen's kappa on every delivery is a defensible differentiator. Most annotation vendors do not publish accuracy scores at all.
4. **Technical credibility** — Interactive annotation demo, CSS design system, direct webhook integration, SEO-structured content — built without frameworks, fast and clean.
5. **Content engine** — 7 technical blogs + 4 case studies already published, establishing organic SEO and thought leadership in a space where most competitors have no content strategy.

---

*Document generated from Claude Code session — June 2026*
