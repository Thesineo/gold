#!/usr/bin/env python3
"""Replace floating bounding-box overlays in vis-split with top-strip pill style."""

import re

BASE = '/home/aniketnerali16/gold'

def pill(color, text):
    return (
        f'<div style="font-family:\'Space Mono\',monospace;font-size:9px;background:{color};'
        f'color:#0a0a0a;padding:3px 8px;border-radius:2px;letter-spacing:0.07em;white-space:nowrap">'
        f'{text}</div>'
    )

def top_strip(*pills_html):
    inner = '\n      '.join(pills_html)
    return (
        '<div style="position:absolute;left:0;top:0;right:0;'
        'background:linear-gradient(rgba(10,10,10,0.82),transparent);'
        'padding:10px 14px 20px;pointer-events:none;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start">\n'
        f'      {inner}\n'
        '    </div>'
    )

def bottom_right_badge(color, text):
    return (
        f'<div style="position:absolute;right:4%;bottom:10%;pointer-events:none;text-align:right">'
        f'<div style="font-family:\'Space Mono\',monospace;font-size:9px;background:{color};'
        f'color:#0a0a0a;padding:4px 10px;border-radius:2px;letter-spacing:0.07em;display:inline-block">'
        f'{text}</div></div>'
    )

def gradient_bar(label, color_stops, labels_left_right_right2, bottom='14%'):
    gradient = ','.join(f'{c} {p}' for c, p in color_stops)
    l, m, r = labels_left_right_right2
    return (
        f'<div style="position:absolute;left:4%;bottom:{bottom};pointer-events:none">'
        f'<div style="font-family:\'Space Mono\',monospace;font-size:9px;color:#ffffffaa;'
        f'letter-spacing:0.08em;margin-bottom:4px">{label}</div>'
        f'<div style="width:180px;height:3px;background:linear-gradient(to right,{gradient});'
        f'border-radius:2px"></div>'
        f'<div style="display:flex;justify-content:space-between;width:180px;margin-top:3px">'
        f'<span style="font-family:\'Space Mono\',monospace;font-size:8px;color:#ffffff55">{l}</span>'
        f'<span style="font-family:\'Space Mono\',monospace;font-size:8px;color:#ffffff55">{m}</span>'
        f'<span style="font-family:\'Space Mono\',monospace;font-size:8px;color:#ffffffaa">{r}</span>'
        f'</div></div>'
    )

# ── Per-service overlay content ───────────────────────────────────────────────
OVERLAYS = {
    'service-rlhf.html': {
        'strip': top_strip(
            pill('#6c5ce7', '● RESPONSE A · EVALUATING'),
            pill('#00b894', '✓ RESPONSE B · PREFERRED'),
            pill('#ff6b6b', '⚠ HALLUCINATION ×2'),
            pill('#fdcb6e', '● PREF SCORE: 4.8/5'),
        ),
        'bottom_left': gradient_bar(
            '▼ ANNOTATOR PREFERENCE SIGNAL',
            [('#ff6b6b','0%'),('#fdcb6e','40%'),('#00b894','75%'),('#00b894','100%')],
            ('REJECT','NEUTRAL','PREFER ▶'),
            bottom='14%',
        ),
        'bottom_right': bottom_right_badge('#00b894', '✓ 2,400 PREFERENCE PAIRS'),
    },
    'service-nlp.html': {
        'strip': top_strip(
            pill('#a29bfe', '● PERSON ENTITY'),
            pill('#81ecec', '● ORGANIZATION'),
            pill('#fab365', '● LOCATION'),
            pill('#fd79a8', '● DATE / AMOUNT'),
        ),
        'bottom_left': (
            '<div style="position:absolute;left:4%;bottom:10%;pointer-events:none;'
            'display:flex;flex-direction:column;gap:4px">'
            '<div style="font-family:\'Space Mono\',monospace;font-size:9px;color:#ffffffaa;'
            'letter-spacing:0.08em;margin-bottom:2px">▼ ENTITY TYPES DETECTED</div>'
            + ''.join(
                f'<div style="display:flex;align-items:center;gap:6px">'
                f'<div style="width:8px;height:8px;border-radius:2px;background:{c};flex-shrink:0"></div>'
                f'<span style="font-family:\'Space Mono\',monospace;font-size:9px;color:#ffffffaa">{t}</span>'
                f'</div>'
                for c, t in [
                    ('#a29bfe','PERSON'),
                    ('#81ecec','ORG'),
                    ('#fab365','LOC'),
                    ('#fd79a8','DATE'),
                    ('#55efc4','AMOUNT'),
                ]
            )
            + '</div>'
        ),
        'bottom_right': bottom_right_badge('#81ecec', '✓ 38,420 ENTITIES TAGGED'),
    },
    'service-sft.html': {
        'strip': top_strip(
            pill('#55efc4', '● INSTRUCTION QUALITY: 4.7'),
            pill('#00b894', '✓ INCLUDE IN TRAINING'),
            pill('#ff7675', '✗ EXCLUDE · HAZARD'),
            pill('#a29bfe', '● SFT SCORE: 4.1/5'),
        ),
        'bottom_left': gradient_bar(
            '▼ INCLUDE / EXCLUDE SPLIT',
            [('#00b894','0%'),('#00b894','78%'),('#ff7675','78%'),('#ff7675','100%')],
            ('0%', '78% INCLUDE', '100%'),
            bottom='14%',
        ),
        'bottom_right': bottom_right_badge('#55efc4', '✓ 78.4% INCLUDE RATE'),
    },
    'service-sycophancy.html': {
        'strip': top_strip(
            pill('#fd79a8', '⚠ SYCOPHANTIC TURN'),
            pill('#55efc4', '✓ HONEST RESPONSE'),
            pill('#fdcb6e', '⚠ CAPITULATION'),
            pill('#ff6b6b', '● BIAS SCORE: 74%'),
        ),
        'bottom_left': gradient_bar(
            '▼ SYCOPHANCY RATE THIS BATCH',
            [('#55efc4','0%'),('#fdcb6e','45%'),('#fd79a8','75%'),('#ff6b6b','100%')],
            ('HONEST', 'PARTIAL', '74% HIGH ▶'),
            bottom='14%',
        ),
        'bottom_right': bottom_right_badge('#fd79a8', '⚠ REQUIRES RLHF RETRAINING'),
    },
    'service-redteaming.html': {
        'strip': top_strip(
            pill('#ff4d4d', '🔴 CRITICAL PROBE'),
            pill('#e17300', '⚠ HIGH SEVERITY'),
            pill('#fdcb6e', '● MEDIUM RISK'),
            pill('#55efc4', '✓ MITIGATED: 74%'),
        ),
        'bottom_left': gradient_bar(
            '▼ SEVERITY DISTRIBUTION',
            [('#ff4d4d','0%'),('#e17300','20%'),('#fdcb6e','45%'),('#55efc4','70%'),('#55efc4','100%')],
            ('CRITICAL', 'HIGH / MED', 'MITIGATED ▶'),
            bottom='14%',
        ),
        'bottom_right': bottom_right_badge('#ff4d4d', '420 PROBES · 12 CRITICAL'),
    },
    'service-hallucination.html': {
        'strip': top_strip(
            pill('#00b894', '✓ VERIFIED CLAIM'),
            pill('#ff4d4d', '✗ HALLUCINATED'),
            pill('#fdcb6e', '? UNSUPPORTED'),
            pill('#a29bfe', '~ PARTIAL MATCH'),
        ),
        'bottom_left': gradient_bar(
            '▼ CLAIM VERIFICATION RATE',
            [('#00b894','0%'),('#00b894','68%'),('#fdcb6e','68%'),('#fdcb6e','82%'),('#ff4d4d','82%'),('#ff4d4d','100%')],
            ('0%', '68% VERIFIED', '100%'),
            bottom='14%',
        ),
        'bottom_right': bottom_right_badge('#ff4d4d', '⚠ 14.2% HALLUCINATION RATE'),
    },
    'service-code-rlhf.html': {
        'strip': top_strip(
            pill('#ff6b6b', '✗ RESPONSE A · REJECTED'),
            pill('#00b894', '✓ RESPONSE B · PREFERRED'),
            pill('#a29bfe', '● THREAD SAFE'),
            pill('#55efc4', '● CORRECTNESS: 9.1/10'),
        ),
        'bottom_left': gradient_bar(
            '▼ CODE QUALITY COMPARISON',
            [('#ff6b6b','0%'),('#ff6b6b','35%'),('#fdcb6e','35%'),('#00b894','65%'),('#00b894','100%')],
            ('RESP A', 'NEUTRAL', 'RESP B ▶'),
            bottom='14%',
        ),
        'bottom_right': bottom_right_badge('#00b894', '✓ 5,800 CODE PAIRS · IAA 0.82'),
    },
    'service-image.html': {
        'strip': top_strip(
            pill('#00b894', '● CAR · 0.98'),
            pill('#a29bfe', '● PEDESTRIAN · 0.96'),
            pill('#fdcb6e', '● MOTORCYCLE · 0.89'),
            pill('#e17300', '● TRUCK · 0.94'),
        ),
        'bottom_left': (
            '<div style="position:absolute;left:4%;bottom:10%;pointer-events:none;'
            'display:flex;flex-direction:column;gap:4px">'
            '<div style="font-family:\'Space Mono\',monospace;font-size:9px;color:#ffffffaa;'
            'letter-spacing:0.08em;margin-bottom:2px">▼ CLASS DETECTION SUMMARY</div>'
            + ''.join(
                f'<div style="display:flex;align-items:center;gap:6px">'
                f'<div style="width:8px;height:8px;border-radius:2px;background:{c};flex-shrink:0"></div>'
                f'<span style="font-family:\'Space Mono\',monospace;font-size:9px;color:#ffffffaa">{t}</span>'
                f'</div>'
                for c, t in [
                    ('#00b894','CAR ×2'),
                    ('#a29bfe','PEDESTRIAN ×2'),
                    ('#fdcb6e','MOTORCYCLE ×1'),
                    ('#e17300','TRUCK ×1'),
                    ('#fd79a8','TRAFFIC LIGHT ×1'),
                ]
            )
            + '</div>'
        ),
        'bottom_right': bottom_right_badge('#00b894', '7 OBJECTS · mAP 0.94 · QA PASS ✓'),
    },
    'service-video.html': {
        'strip': top_strip(
            pill('#6c5ce7', '● SPEECH · 3m 12s'),
            pill('#e17300', '● ACTION EVENT'),
            pill('#00b894', '● B-ROLL SEGMENT'),
            pill('#4a7fa5', '● TRANSITION'),
        ),
        'bottom_left': (
            '<div style="position:absolute;left:4%;bottom:14%;pointer-events:none">'
            '<div style="font-family:\'Space Mono\',monospace;font-size:9px;color:#ffffffaa;'
            'letter-spacing:0.08em;margin-bottom:5px">▼ TIMELINE ANNOTATION TRACK</div>'
            '<div style="display:flex;height:10px;width:200px;border-radius:2px;overflow:hidden;gap:2px">'
            '<div style="background:#6c5ce7;flex:3;border-radius:1px"></div>'
            '<div style="background:#e17300;flex:2;border-radius:1px"></div>'
            '<div style="background:#4a7fa5;flex:1;border-radius:1px"></div>'
            '<div style="background:#00b894;flex:2;border-radius:1px"></div>'
            '<div style="background:#2d3436;flex:1;border-radius:1px"></div>'
            '</div>'
            '<div style="display:flex;justify-content:space-between;width:200px;margin-top:3px">'
            '<span style="font-family:\'Space Mono\',monospace;font-size:8px;color:#ffffff55">0:00</span>'
            '<span style="font-family:\'Space Mono\',monospace;font-size:8px;color:#ffffff55">2:16</span>'
            '<span style="font-family:\'Space Mono\',monospace;font-size:8px;color:#ffffffaa">4:32 ▶</span>'
            '</div>'
            '</div>'
        ),
        'bottom_right': bottom_right_badge('#6c5ce7', '✓ 14 SEGMENTS · APPROVED'),
    },
    'service-synthetic-data.html': {
        'strip': top_strip(
            pill('#55efc4', '✓ DIVERSITY: 9.2/10'),
            pill('#a29bfe', '✓ REALISM: 8.8/10'),
            pill('#fdcb6e', '⚠ UNDER REVIEW ×12'),
            pill('#ff6b6b', '✗ FAIL ×8'),
        ),
        'bottom_left': gradient_bar(
            '▼ BATCH QUALITY DISTRIBUTION',
            [('#ff6b6b','0%'),('#fdcb6e','20%'),('#fdcb6e','40%'),('#55efc4','55%'),('#55efc4','100%')],
            ('FAIL', 'REVIEW', '71% PASS ▶'),
            bottom='14%',
        ),
        'bottom_right': bottom_right_badge('#55efc4', '✓ 71.4% PASS RATE · BATCH 18'),
    },
    'service-rag.html': {
        'strip': top_strip(
            pill('#00cec9', '✓ FAITHFUL · 68.4%'),
            pill('#ff6b6b', '✗ UNFAITHFUL · 18.2%'),
            pill('#fdcb6e', '~ PARTIAL · 13.4%'),
            pill('#a29bfe', '● IAA κ: 0.86'),
        ),
        'bottom_left': gradient_bar(
            '▼ RAG FAITHFULNESS BREAKDOWN',
            [('#00cec9','0%'),('#00cec9','68%'),('#fdcb6e','68%'),('#fdcb6e','82%'),('#ff6b6b','82%'),('#ff6b6b','100%')],
            ('0%', '68% FAITHFUL', '100%'),
            bottom='14%',
        ),
        'bottom_right': bottom_right_badge('#00cec9', '✓ 3,200 SOURCE-CLAIM PAIRS'),
    },
}

# ── Apply to each file ────────────────────────────────────────────────────────
for filename, cfg in OVERLAYS.items():
    path = f'{BASE}/{filename}'
    with open(path, 'r') as f:
        html = f.read()

    # Find vis-split-img block and replace the inner overlay divs
    # Pattern: everything between the <img .../> tag and the closing </div> before vis-split-body
    pattern = re.compile(
        r'(<div class="vis-split-img">\s*<img[^>]+>)\s*(?:<div[\s\S]*?</div>\s*)*(\s*</div>\s*<div class="vis-split-body">)',
        re.DOTALL
    )

    new_block = (
        r'\1\n'
        + '    ' + cfg['strip'] + '\n'
        + '    ' + cfg['bottom_left'] + '\n'
        + '    ' + cfg['bottom_right'] + '\n'
        + r'\2'
    )

    new_html, count = pattern.subn(new_block, html, count=1)
    if count == 0:
        print(f'  WARNING: pattern not matched in {filename}')
        continue

    with open(path, 'w') as f:
        f.write(new_html)
    print(f'Updated {filename}')

print('\nDone!')
