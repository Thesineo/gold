#!/usr/bin/env python3
"""Add image sections and hero background images to all pages."""
import re, os

GOLD = '/home/aniketnerali16/gold'

# Shared CSS block to inject into every page (after @keyframes or before </style>)
SHARED_CSS = """
/* ── SHARED VISUAL SECTIONS ─────────────────────────────────────────────── */
.vis-split{display:grid;grid-template-columns:1fr 1fr;min-height:480px;overflow:hidden}
.vis-split-img{position:relative;overflow:hidden}
.vis-split-img img{width:100%;height:100%;object-fit:cover;display:block;filter:brightness(1.08) contrast(1.02) saturate(1.05)}
.vis-split-body{background:var(--paper);color:var(--ink);display:flex;flex-direction:column;justify-content:center;padding:72px 56px;border-left:1px solid var(--border)}
.vis-split-body .sec-eyebrow{color:var(--accent)}
.vis-split-body .sec-title{color:var(--ink)}
.vis-split-body .sec-title em{color:var(--accent);font-style:italic}
.vis-split-body .sec-desc{color:var(--muted);margin-top:16px}
.vis-split-body .btn-cta{display:inline-block;background:var(--ink);color:var(--paper);padding:14px 28px;border-radius:2px;font-size:14px;font-weight:600;text-decoration:none;margin-top:28px;transition:background 0.2s}
.vis-split-body .btn-cta:hover{background:var(--accent)}
@media(max-width:768px){
  .vis-split{grid-template-columns:1fr}
  .vis-split-img{height:260px}
  .vis-split-body{padding:44px 24px;border-left:none;border-top:1px solid var(--border)}
}
"""

# Per-page: hero CSS background image + mid-page vis-split HTML
# hero_img: injected as background on .svc-hero or .page-hero
# split_img: left image in the vis-split panel
# split_heading + split_body: text on the right panel
PAGES = {
    'service-rlhf.html': {
        'hero_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_img': 'https://images.unsplash.com/photo-1677442135136-760c813028c0',
        'split_eyebrow': 'Expert Annotation',
        'split_heading': 'Where <em>human judgment</em> shapes machine alignment',
        'split_body': 'Our RLHF annotators are domain specialists — not crowdworkers. Every preference pair includes structured reasoning so your reward model learns from true signal.',
    },
    'service-nlp.html': {
        'hero_img': 'https://images.unsplash.com/photo-1644088379091-d574269d422f',
        'split_img': 'https://images.unsplash.com/photo-1711409664431-4e7914ac2370',
        'split_eyebrow': 'Language Understanding',
        'split_heading': 'Annotation that understands <em>context, not just tokens</em>',
        'split_body': 'NLP annotation requires human linguists who understand pragmatics, irony, and domain-specific terminology. Our annotators are trained on your domain before touching a single label.',
    },
    'service-sft.html': {
        'hero_img': 'https://plus.unsplash.com/premium_photo-1682124651258-410b25fa9dc0',
        'split_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_eyebrow': 'Instruction Data',
        'split_heading': 'Fine-tuning data written by <em>real domain experts</em>',
        'split_body': 'Doctors, lawyers, engineers, and educators write the ideal responses your model should emulate. The quality ceiling of your SFT model is set right here.',
    },
    'service-sycophancy.html': {
        'hero_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_img': 'https://plus.unsplash.com/premium_photo-1690297732590-b9875f77471d',
        'split_eyebrow': 'Bias Detection',
        'split_heading': 'Find the <em>hidden sycophancy</em> before your users do',
        'split_body': 'Our audit injects 50–100 carefully designed traps into your RLHF pipeline and measures exactly how often annotators reward agreeable-but-wrong responses.',
    },
    'service-redteaming.html': {
        'hero_img': 'https://plus.unsplash.com/premium_photo-1661923972541-08cc6c4e84e7',
        'split_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_eyebrow': 'Adversarial Testing',
        'split_heading': 'We attack your model so <em>bad actors cannot</em>',
        'split_body': 'Structured adversarial probing across 8 attack categories — delivered as a graded risk report with corrective RLHF data to close each gap found.',
    },
    'service-hallucination.html': {
        'hero_img': 'https://plus.unsplash.com/premium_photo-1690297732590-b9875f77471d',
        'split_img': 'https://images.unsplash.com/photo-1711409664431-4e7914ac2370',
        'split_eyebrow': 'Factual Accuracy',
        'split_heading': 'Claim-by-claim verification, <em>not surface-level checking</em>',
        'split_body': 'Every factual claim extracted by our ML pipeline is verified by domain experts against authoritative sources. Delivered with severity tiering and hallucination rate by category.',
    },
    'service-code-rlhf.html': {
        'hero_img': 'https://images.unsplash.com/photo-1644088379091-d574269d422f',
        'split_img': 'https://plus.unsplash.com/premium_photo-1682124651258-410b25fa9dc0',
        'split_eyebrow': 'Code Quality',
        'split_heading': 'Engineers evaluating <em>AI-generated code</em>',
        'split_body': 'Software engineers with specialist pools by language judge AI code on correctness, security, readability, and efficiency. Automated unit test execution and security linting included.',
    },
    'service-image.html': {
        'hero_img': 'https://images.unsplash.com/photo-1677442135136-760c813028c0',
        'split_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_eyebrow': 'Computer Vision',
        'split_heading': 'SAM2-powered annotation, <em>human-expert verified</em>',
        'split_body': 'AI pre-annotation reduces manual work 40–60%. Every bounding box, polygon, and keypoint is validated by expert annotators. Medical DICOM labeling included.',
    },
    'service-video.html': {
        'hero_img': 'https://plus.unsplash.com/premium_photo-1741723515540-16a4e71b7d49',
        'split_img': 'https://images.unsplash.com/photo-1644088379091-d574269d422f',
        'split_eyebrow': 'Temporal Annotation',
        'split_heading': 'Object tracking with <em>consistent identity across frames</em>',
        'split_body': 'ByteTrack-powered multi-object tracking with temporal interpolation reduces frame-by-frame annotation work 70%. Supports autonomous vehicles, healthcare, and surveillance.',
    },
    'service-synthetic-data.html': {
        'hero_img': 'https://images.unsplash.com/photo-1644088379091-d574269d422f',
        'split_img': 'https://plus.unsplash.com/premium_photo-1690297732590-b9875f77471d',
        'split_eyebrow': 'Data Quality',
        'split_heading': 'Synthetic data that <em>humans trust</em>',
        'split_body': 'AI-generated training data reviewed for bias, hallucination, distribution drift, and edge-case coverage. The trust layer that synthetic data needs to reach production.',
    },
    'service-rag.html': {
        'hero_img': 'https://images.unsplash.com/photo-1711409664431-4e7914ac2370',
        'split_img': 'https://images.unsplash.com/photo-1644088379091-d574269d422f',
        'split_eyebrow': 'RAG Evaluation',
        'split_heading': 'Does your RAG system <em>actually use the context</em>?',
        'split_body': 'Human evaluators assess whether retrieval surfaces the right context and whether generation faithfully uses it. Detects faithfulness failures before they reach your enterprise users.',
    },
    'service-retainer.html': {
        'hero_img': 'https://images.unsplash.com/photo-1742459785723-667110cf8326',
        'split_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_eyebrow': 'Continuous Quality',
        'split_heading': 'Your model stays aligned as <em>user behaviour evolves</em>',
        'split_body': 'A standing team permanently assigned to your model. Weekly output evaluation, monthly quality reports, drift alerts, and a curated retraining batch. SLA-backed.',
    },
    'industry-legal.html': {
        'hero_img': 'https://plus.unsplash.com/premium_photo-1739916464317-badd61faf75a',
        'split_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_eyebrow': 'Legal AI',
        'split_heading': 'Annotation by <em>qualified lawyers</em>, not paralegals',
        'split_body': 'Our legal annotator pool includes practicing advocates, CS graduates with legal training, and compliance specialists who understand the stakes of every annotation decision.',
    },
    'industry-finance.html': {
        'hero_img': 'https://plus.unsplash.com/premium_photo-1661923972541-08cc6c4e84e7',
        'split_img': 'https://images.unsplash.com/photo-1644088379091-d574269d422f',
        'split_eyebrow': 'Finance & BFSI',
        'split_heading': 'CAs and banking professionals <em>annotating financial AI</em>',
        'split_body': 'Chartered Accountants and banking professionals handle KYC, loan documents, fraud detection data, and financial AI RLHF — with the domain literacy your models require.',
    },
    'industry-automative.html': {
        'hero_img': 'https://plus.unsplash.com/premium_photo-1741723515540-16a4e71b7d49',
        'split_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_eyebrow': 'Autonomous Vehicles',
        'split_heading': 'Indian road conditions that <em>Western providers cannot supply</em>',
        'split_body': 'Auto-rickshaws, cattle crossings, unstructured intersections, monsoon visibility — authentic Indian traffic annotation for AV systems that will actually operate here.',
    },
    'industry-agriculture.html': {
        'hero_img': 'https://images.unsplash.com/photo-1644088379091-d574269d422f',
        'split_img': 'https://plus.unsplash.com/premium_photo-1690297732590-b9875f77471d',
        'split_eyebrow': 'AgriTech',
        'split_heading': 'Annotators who understand <em>Indian crops and soil</em>',
        'split_body': 'Satellite imagery, drone footage, and field photo annotation for crop disease detection, yield estimation, and PMFBY insurance claims — by annotators who know the field.',
    },
    'industry-genai.html': {
        'hero_img': 'https://plus.unsplash.com/premium_photo-1690297732590-b9875f77471d',
        'split_img': 'https://images.unsplash.com/photo-1711409664431-4e7914ac2370',
        'split_eyebrow': 'Enterprise GenAI',
        'split_heading': 'Production AI that stays <em>aligned as usage grows</em>',
        'split_body': 'RAG faithfulness evaluation, continuous hallucination monitoring, and red-teaming to keep enterprise AI assistants and copilots safe, accurate, and aligned at scale.',
    },
    'about.html': {
        'hero_img': 'https://images.unsplash.com/photo-1742459785723-667110cf8326',
        'split_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_eyebrow': 'Our Mission',
        'split_heading': 'Training data built with <em>engineering rigour</em>',
        'split_body': 'Concave AI was founded by an ML engineer who got tired of watching model quality degrade because of low-quality annotation. Every process we build reflects that original frustration.',
    },
    'quality.html': {
        'hero_img': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01',
        'split_img': 'https://plus.unsplash.com/premium_photo-1681487548276-48a2c640ade9',
        'split_eyebrow': 'Quality Standards',
        'split_heading': 'Metrics you can <em>verify yourself</em>',
        'split_body': "Every delivery ships with a QA report: Cohen's kappa scores, gold standard accuracy per annotator, batch error rates, and a data card. No competitor does this as standard.",
    },
}

def make_hero_bg_css(img_url, selector):
    return (
        f'\n{selector}'
        '{background-image:linear-gradient(rgba(245,242,236,0.91),rgba(245,242,236,0.91)),'
        f'url(\'{img_url}?w=1600&q=80&auto=format&fit=crop\');'
        'background-size:cover;background-position:center;}'
    )

def make_vis_split(cfg):
    return f"""
<!-- Mid-page visual section -->
<section class="vis-split">
  <div class="vis-split-img">
    <img src="{cfg['split_img']}?w=800&q=80&auto=format&fit=crop" alt="{cfg['split_eyebrow']}" loading="lazy">
  </div>
  <div class="vis-split-body">
    <span class="sec-eyebrow">{cfg['split_eyebrow']}</span>
    <h2 class="sec-title" style="margin-top:12px">{cfg['split_heading']}</h2>
    <p class="sec-desc">{cfg['split_body']}</p>
    <a href="contact.html" class="btn-cta">Get a Free Audit →</a>
  </div>
</section>
"""

def process_file(fname, cfg):
    path = os.path.join(GOLD, fname)
    if not os.path.exists(path):
        print(f'SKIP (not found): {fname}')
        return
    with open(path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Skip entirely only if already has both CSS and HTML
    if '.vis-split{' in html and '<section class="vis-split">' in html:
        print(f'SKIP (complete): {fname}')
        return

    # 1. Inject shared CSS before </style> (skip if already present)
    if '.vis-split{' not in html:
        html = html.replace('</style>', SHARED_CSS + '\n</style>', 1)

    # 2. Add hero background image CSS
    # Detect which hero selector this file uses
    if '.svc-hero{' in html or '.svc-hero {' in html:
        selector = '.svc-hero'
    elif '.page-hero{' in html or '.page-hero {' in html:
        selector = '.page-hero'
    else:
        selector = None

    if selector and 'background-image:linear-gradient' not in html:
        hero_css = make_hero_bg_css(cfg['hero_img'], selector)
        html = html.replace('</style>', hero_css + '\n</style>', 1)

    # 3. Insert vis-split after first </section> that follows a ticker
    # Pattern: find the second <section class="... after the first ticker
    # Strategy: insert after the first big section (after the first ticker block)
    vis_html = make_vis_split(cfg)
    if '<section class="vis-split">' not in html:
        # Find a good insertion point: after the first </section> that comes
        # after the first ticker div
        ticker_pos = html.find('<div class="ticker">')
        if ticker_pos == -1:
            ticker_pos = html.find('class="ticker"')
        if ticker_pos != -1:
            # Find the next </section> after first ticker
            next_sec_end = html.find('</section>', ticker_pos)
            if next_sec_end != -1:
                insert_pos = next_sec_end + len('</section>')
                html = html[:insert_pos] + '\n' + vis_html + html[insert_pos:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'DONE: {fname}')

for fname, cfg in PAGES.items():
    process_file(fname, cfg)

print('\nAll pages processed.')
