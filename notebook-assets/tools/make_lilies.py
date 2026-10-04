#!/usr/bin/env python3
"""Generate the original blue-lily (agapanthus) SVG set in notebook-assets/flowers/.

All artwork is generated here from math + a seeded PRNG: it is original work with no third-party
source, dedicated to the public domain (CC0). Deterministic: same seed => identical files, which
matches the spec's "deterministic, not random" placement rule (Ch.11.5).

Palette = the spec's blue tokens (Ch.58): --color-lily #7A9ED6, accent #2E5BB8, ink #0A1A44, accent-soft #D6E2F7.

Run:  python tools/make_lilies.py        (writes flowers/*.svg + flowers/manifest.json)
"""
import json, math, os, random

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "flowers")
LILY, ACC, INK, SOFT, MIST = "#7A9ED6", "#2E5BB8", "#0A1A44", "#D6E2F7", "#EAF1FB"
LEAF, STEM = "#6F8F86", "#5B7A72"

DEFS = f"""<defs>
<linearGradient id="petal" x1="0" y1="1" x2="0" y2="0">
  <stop offset="0" stop-color="{SOFT}"/><stop offset=".45" stop-color="{LILY}"/><stop offset="1" stop-color="{ACC}"/></linearGradient>
<linearGradient id="petalHi" x1="0" y1="1" x2="0" y2="0">
  <stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="{LILY}"/></linearGradient>
<linearGradient id="leaf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="{STEM}"/><stop offset="1" stop-color="{LEAF}" stop-opacity=".85"/></linearGradient>
</defs>"""


def f(v):
    return f"{v:.1f}"


def tepal(L, W, fill="url(#petal)", stroke=INK, sw=0.6, op=0.92, rib=True):
    """One tepal: leaf shape from (0,0) to tip (0,-L) with a midrib."""
    d = (f"M0 0 C{f(W)} {f(-L*.28)} {f(W*.85)} {f(-L*.78)} 0 {f(-L)} "
         f"C{f(-W*.85)} {f(-L*.78)} {f(-W)} {f(-L*.28)} 0 0Z")
    s = f'<path d="{d}" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-opacity=".35" stroke-width="{sw}"/>'
    if rib:
        s += f'<path d="M0 {f(-L*.08)} L0 {f(-L*.9)}" stroke="{INK}" stroke-opacity=".18" stroke-width=".5" fill="none"/>'
    return s


def floret(rng, x, y, ang, size, line=False):
    """A floret seen from the side: fan of tepals + stamens, rotated to point outward."""
    L, W = size, size * 0.26
    parts = []
    for da, k in ((-48, .86), (48, .86), (-24, .96), (24, .96), (0, 1.0)):
        da += rng.uniform(-4, 4)
        t = tepal(L * k * rng.uniform(.95, 1.05), W, rib=not line)
        if line:
            t = t.replace('fill="url(#petal)"', 'fill="none"').replace(f'stroke="{INK}"', 'stroke="currentColor"')
        parts.append(f'<g transform="rotate({f(da)})">{t}</g>')
    for da in (-14, 0, 14):  # stamens
        ln = L * rng.uniform(1.05, 1.28)
        bx = math.sin(math.radians(da)) * ln * .15
        parts.append(f'<path d="M0 0 Q{f(bx)} {f(-ln*.6)} {f(math.sin(math.radians(da))*ln*.35)} {f(-ln)}" '
                     f'stroke="{INK if not line else "currentColor"}" stroke-opacity=".55" stroke-width=".6" fill="none"/>'
                     f'<circle cx="{f(math.sin(math.radians(da))*ln*.35)}" cy="{f(-ln)}" r="{f(size*.035)}" fill="{INK if not line else "currentColor"}" fill-opacity=".7"/>')
    return f'<g transform="translate({f(x)} {f(y)}) rotate({f(ang)})">{"".join(parts)}</g>'


def umbel(rng, cx, cy, radius, n, size, line=False):
    out = []
    pts = []
    for i in range(n):  # golden-angle spread in a half-dome so florets fan outward
        a = -90 + (rng.random() - .5) * 200 * (0.35 + 0.65 * (i / n))
        r = radius * (0.35 + 0.65 * math.sqrt(rng.random()))
        pts.append((a, r))
    for a, r in sorted(pts, key=lambda p: p[1]):
        x, y = cx + math.cos(math.radians(a)) * r * .9, cy + math.sin(math.radians(a)) * r * .75
        ang = a + 90 + rng.uniform(-10, 10)
        pedicel = f'<path d="M{f(cx)} {f(cy)} Q{f((cx+x)/2)} {f((cy+y)/2-6)} {f(x)} {f(y)}" stroke="{STEM if not line else "currentColor"}" stroke-width="1" fill="none" stroke-opacity=".8"/>'
        out.append(pedicel + floret(rng, x, y, ang, size * rng.uniform(.85, 1.1), line))
    return "".join(out)


def leaf(x, y, L, bend, w, line=False):
    d = f"M{f(x)} {f(y)} C{f(x+bend*.3)} {f(y-L*.4)} {f(x+bend)} {f(y-L*.8)} {f(x+bend*1.3)} {f(y-L)} C{f(x+bend*.9+w)} {f(y-L*.7)} {f(x+w+bend*.1)} {f(y-L*.3)} {f(x+w)} {f(y)}Z"
    if line:
        return f'<path d="{d}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>'
    return f'<path d="{d}" fill="url(#leaf)" stroke="{INK}" stroke-opacity=".25" stroke-width=".6"/>'


def svg(w, h, body, title, line=False, extra=""):
    d = "" if line else DEFS
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{d}{extra}{body}</svg>\n')


def full(seed, line=False, florets=22):
    rng = random.Random(seed)
    cx, cy = 200, 150
    stem = f'<path d="M200 560 C196 440 206 300 {cx} {cy}" stroke="{STEM if not line else "currentColor"}" stroke-width="5" fill="none" stroke-linecap="round"/>'
    leaves = "".join(leaf(200 + dx, 568, L, b, w, line) for dx, L, b, w in ((-8, 250, -120, 16), (-2, 300, -60, 14), (4, 280, 70, 14), (10, 230, 130, 16)))
    return svg(400, 580, leaves + stem + umbel(rng, cx, cy, 120, florets, 70, line), "Blue lily (agapanthus)", line)


def bloom(seed, line=False):
    rng = random.Random(seed)
    return svg(220, 260, floret(rng, 110, 235, 0, 130, line), "Blue lily bloom", line)


def petal_svg(line=False):
    t = tepal(150, 40, fill="none" if line else "url(#petal)", stroke="currentColor" if line else INK, sw=1.4 if line else .8)
    return svg(120, 170, f'<g transform="translate(60 160)">{t}</g>', "Blue lily petal", line)


def corner(seed):
    rng = random.Random(seed)
    stems = ""
    for i, (x0, y0, x1, y1, x2, y2) in enumerate(((10, 10, 100, 40, 170, 130), (10, 10, 60, 120, 120, 200), (10, 10, 150, 20, 240, 60))):
        stems += f'<path d="M{x0} {y0} Q{x1} {y1} {x2} {y2}" stroke="{STEM}" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    blooms = "".join(floret(rng, x, y, a, s) for x, y, a, s in ((170, 130, 150, 52), (120, 200, 175, 46), (240, 60, 120, 44), (96, 52, 140, 34), (62, 120, 165, 32)))
    lv = leaf(14, 14, 120, 40, 10).replace("url(#leaf)", "url(#leaf)")
    return svg(330, 270, stems + lv + blooms, "Blue lily corner ornament")


def divider(seed):
    rng = random.Random(seed)
    line = f'<path d="M10 100 C120 90 200 112 300 100 S 480 90 590 100" stroke="{STEM}" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    b = floret(rng, 300, 98, 0, 46) + floret(rng, 240, 104, -62, 30) + floret(rng, 362, 96, 62, 30)
    return svg(600, 150, line + b, "Blue lily divider")


def pressed(seed):
    """Pressed-flower look: flattened, slightly translucent, paper-tinted, faint shadow."""
    rng = random.Random(seed)
    body = (f'<g opacity=".82" filter="url(#soft)"><path d="M200 560 C196 440 206 300 200 150" stroke="{STEM}" stroke-width="4" fill="none"/>'
            + umbel(rng, 200, 150, 115, 18, 64) + "</g>")
    extra = '<filter id="soft"><feGaussianBlur stdDeviation=".35"/></filter><rect width="400" height="580" fill="#fff" fill-opacity="0"/>'
    return svg(400, 580, body, "Pressed blue lily", extra=extra)


def silhouette(seed):
    s = full(seed, florets=20)
    # flatten to a single ink colour
    for a in (INK, ACC, LILY, SOFT, STEM, LEAF):
        s = s.replace(a, INK)
    return s.replace('fill="url(#petal)"', f'fill="{INK}"').replace('fill="url(#leaf)"', f'fill="{INK}"')


def watermark(seed):
    return full(seed, line=True, florets=26).replace('role="img"', 'role="img" color="#7A9ED6" opacity=".12"').replace(
        'aria-label="Blue lily (agapanthus)"', 'aria-label="" aria-hidden="true"')


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {
        "lily-illustration.svg": ("LilyIllustration", full(7)),
        "lily-illustration-b.svg": ("LilyIllustration (variant B)", full(21, florets=16)),
        "lily-bloom.svg": ("LilyDecoration (single bloom)", bloom(3)),
        "lily-petal.svg": ("LilyPetal", petal_svg()),
        "lily-corner.svg": ("LilyCorner", corner(11)),
        "lily-divider.svg": ("LilyDivider", divider(5)),
        "lily-pressed.svg": ("LilyPressedFlower", pressed(9)),
        "lily-line.svg": ("LilyIllustration (line drawing, currentColor)", full(7, line=True)),
        "lily-silhouette.svg": ("LilySilhouette / chapter mark", silhouette(7)),
        "lily-watermark.svg": ("LilyWatermark", watermark(13)),
    }
    manifest = []
    for name, (comp, content) in files.items():
        open(os.path.join(OUT, name), "w").write(content)
        manifest.append(dict(file=name, component=comp, bytes=len(content.encode()), source="original, generated by tools/make_lilies.py", license="CC0-1.0"))
    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
    print("wrote", len(files), "svgs ->", OUT)


if __name__ == "__main__":
    main()
