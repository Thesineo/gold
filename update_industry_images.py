#!/usr/bin/env python3
"""Replace industry page images with contextually relevant ones."""

import re

# Industry-specific image assignments
INDUSTRIES = {
    'industry-agriculture.html': {
        'hero_old': 'photo-1644088379091-d574269d422f',
        'hero_new': 'photo-1708251614787-eaf36f10e6e8',  # precision drone over crop fields
        'split_old': 'premium_photo-1690297732590-b9875f77471d',
        'split_new': 'photo-1632083000159-8e17b5ae7fd5',  # satellite view smart farm
        'sec_bg': 'photo-1566678408000-b4ed750a936e',     # aerial farm patchwork fields
        'alt': 'Smart Agriculture AI',
    },
    'industry-automative.html': {
        'hero_old': 'premium_photo-1741723515540-16a4e71b7d49',
        'hero_new': 'photo-1647733258571-f001185e80c3',   # LiDAR point cloud visualization
        'split_old': 'photo-1677442135703-1787eea5ce01',
        'split_new': 'photo-1685984351005-a971d72c2e35',  # autonomous vehicle on road
        'sec_bg': 'photo-1685984351037-f5c0926a716e',     # self-driving cockpit sensor view
        'alt': 'Autonomous Vehicle AI',
    },
    'industry-finance.html': {
        'hero_old': 'premium_photo-1661923972541-08cc6c4e84e7',
        'hero_new': 'premium_photo-1681760172394-1c13fc445fd4',  # fintech trading screens
        'split_old': 'photo-1644088379091-d574269d422f',
        'split_new': 'photo-1726065235158-d9c3f817f331',   # digital banking interface
        'sec_bg': 'photo-1599050751795-6cdaafbc2319',      # financial data charts trading
        'alt': 'Fintech & BFSI AI',
    },
    'industry-genai.html': {
        'hero_old': 'premium_photo-1690297732590-b9875f77471d',
        'hero_new': 'premium_photo-1726735265218-55decec0bb55',  # human with AI hologram
        'split_old': 'photo-1711409664431-4e7914ac2370',
        'split_new': 'photo-1677212004257-103cfa6b59d0',   # generative AI glowing
        'sec_bg': 'photo-1695902173528-0b15104c4554',      # AI enterprise human interaction
        'alt': 'Enterprise GenAI',
    },
    'industry-legal.html': {
        'hero_old': 'premium_photo-1739916464317-badd61faf75a',
        'hero_new': 'premium_photo-1695942301071-a70004b9e916',  # legal tech gavel scales
        'split_old': 'photo-1677442135703-1787eea5ce01',
        'split_new': 'photo-1645570990200-2701a49d45ca',   # digital legal documents tech
        'sec_bg': 'photo-1654588833369-5174f4640cd2',      # courtroom law scales justice
        'alt': 'Legal AI Technology',
    },
}

BASE = '/home/aniketnerali16/gold'
IMG_BASE = 'https://images.unsplash.com/'
PLUS_BASE = 'https://plus.unsplash.com/'

def img_url(photo_id, w=800):
    base = PLUS_BASE if photo_id.startswith('premium_') else IMG_BASE
    return f"{base}{photo_id}?w={w}&q=80&auto=format&fit=crop"

def hero_css(photo_id):
    url = img_url(photo_id, w=1600)
    return f"background-image:linear-gradient(rgba(245,242,236,0.91),rgba(245,242,236,0.91)),url('{url}');background-size:cover;background-position:center;"

def sec_bg_style(photo_id):
    url = img_url(photo_id, w=1600)
    return (
        f"background-image:linear-gradient(rgba(245,242,236,0.88),rgba(245,242,236,0.88)),url('{url}');"
        f"background-size:cover;background-position:center;"
    )

for filename, cfg in INDUSTRIES.items():
    path = f"{BASE}/{filename}"
    with open(path, 'r') as f:
        html = f.read()

    # 1. Replace hero background-image URL
    old_hero_url = img_url(cfg['hero_old'], w=1600)
    new_hero_url = img_url(cfg['hero_new'], w=1600)
    html = html.replace(old_hero_url, new_hero_url)

    # 2. Replace vis-split img src
    old_split_url = img_url(cfg['split_old'], w=800)
    new_split_url = img_url(cfg['split_new'], w=800)
    html = html.replace(old_split_url, new_split_url)

    # Update alt text for vis-split image
    html = re.sub(
        r'(<img src="' + re.escape(new_split_url) + r'" alt=")[^"]*(")',
        r'\g<1>' + cfg['alt'] + r'\g<2>',
        html
    )

    # 3. Add background image to the first <section class="sec"> after the vis-split
    # Find the vis-split section first
    vis_split_end = html.find('</section>', html.find('<section class="vis-split">'))
    if vis_split_end == -1:
        print(f"  WARNING: vis-split not found in {filename}")
        continue

    # Find the next <section class="sec"> after vis-split
    next_sec_pos = html.find('<section class="sec">', vis_split_end)
    if next_sec_pos == -1:
        print(f"  WARNING: No .sec section found after vis-split in {filename}")
    else:
        old_sec_tag = '<section class="sec">'
        new_sec_tag = f'<section class="sec" style="{sec_bg_style(cfg["sec_bg"])}">'
        # Only replace the first occurrence after vis-split
        html = html[:next_sec_pos] + html[next_sec_pos:].replace(old_sec_tag, new_sec_tag, 1)
        print(f"  Added section background to {filename}")

    with open(path, 'w') as f:
        f.write(html)

    print(f"Updated {filename}")

print("\nDone! All industry pages updated with contextually relevant images.")
