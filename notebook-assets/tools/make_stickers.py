#!/usr/bin/env python3
"""Pre-cut a starter sticker set from private source photos (runs 100% locally).

Usage (from notebook-assets/):
    python -m venv .venv && . .venv/bin/activate
    pip install rembg onnxruntime pillow numpy scipy
    U2NET_HOME=./models python tools/make_stickers.py [--model silueta] [--only 14,19]

Inputs : source/<file>.jpeg  +  private/photos.manifest.json (rotation per photo)
Outputs: stickers-private/<id>-cutout.png   transparent, trimmed
         stickers-private/<id>-sticker.png  white die-cut border + soft shadow
         private/stickers.report.json       quality score per photo

Everything written here is PRIVATE (gitignored). Nothing is uploaded anywhere.
The quality heuristic is deliberately simple: it only flags results a human should look at.
"""
import argparse, json, os, sys, time
import numpy as np
from PIL import Image, ImageFilter, ImageOps
from scipy import ndimage
from rembg import new_session, remove

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAX_IN, MAX_OUT = 1200, 900


def trim(im, pad=0):
    bbox = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(l - pad, 0), max(t - pad, 0), min(r + pad, im.width), min(b + pad, im.height)))


def harden(cut, lo=0.30, hi=0.70, island=0.03):
    """Make the matte mostly opaque (so hair doesn't turn grey over the white border)
    and drop small disconnected specks the model hallucinates."""
    a = np.asarray(cut.getchannel("A")).astype(np.float32) / 255.0
    t = np.clip((a - lo) / (hi - lo), 0, 1)
    a = t * t * (3 - 2 * t)  # smoothstep
    lab, n = ndimage.label(a > 0.5)
    if n > 1:
        sizes = ndimage.sum(a > 0.5, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= island * sizes.max()])
        keep = ndimage.binary_dilation(keep, iterations=6)  # keep soft edge pixels near kept parts
        a = a * keep
    out = cut.copy()
    out.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
    return out


def quality(alpha):
    """Return (fg_ratio, largest_component_share, verdict)."""
    mask = alpha > 128
    ratio = float(mask.mean())
    lab, n = ndimage.label(mask)
    share = 0.0
    if n:
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        share = float(sizes.max() / mask.sum())
    ok = 0.06 <= ratio <= 0.88 and share >= 0.80
    return ratio, share, ("ok" if ok else "review")


def sticker_style(cut, border_frac=0.022, shadow=True):
    """White die-cut border + soft contact shadow. Border width scales with sticker size."""
    border = max(6, int(max(cut.size) * border_frac))
    pad = border * 3
    canvas = Image.new("RGBA", (cut.width + pad * 2, cut.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(cut, (pad, pad), cut)
    a = canvas.getchannel("A").point(lambda v: 255 if v > 64 else 0)
    # grow the silhouette by `border` px (MaxFilter needs an odd size)
    grown = a.filter(ImageFilter.MaxFilter(2 * (border // 2) * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2))
    grown = grown.point(lambda v: 255 if v > 100 else 0).filter(ImageFilter.GaussianBlur(0.8))
    out = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", canvas.size, (16, 26, 51, 0))
        sh.putalpha(grown.filter(ImageFilter.GaussianBlur(border * 0.9)).point(lambda v: int(v * 0.35)))
        out.alpha_composite(sh, (0, int(border * 0.45)))
    white = Image.new("RGBA", canvas.size, (255, 255, 255, 255))
    white.putalpha(grown)
    out.alpha_composite(white)
    out.alpha_composite(canvas)
    return trim(out, pad=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="silueta", choices=["u2netp", "silueta", "u2net_human_seg"])
    ap.add_argument("--only", default="", help="comma-separated ids")
    ap.add_argument("--manifest", default=os.path.join(ROOT, "private", "photos.manifest.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "stickers-private"))
    a = ap.parse_args()
    only = {s.strip() for s in a.only.split(",") if s.strip()}

    manifest = json.load(open(a.manifest))["photos"]
    os.makedirs(a.out, exist_ok=True)
    sess = new_session(a.model)
    report = {}
    for p in manifest:
        if only and p["id"] not in only:
            continue
        src = os.path.join(ROOT, "source", p["file"])
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        if p["rotate_cw_deg"]:
            im = im.rotate(-p["rotate_cw_deg"], expand=True)  # PIL is counter-clockwise; negative = clockwise
        im.thumbnail((MAX_IN, MAX_IN), Image.LANCZOS)
        t = time.time()
        cut = harden(remove(im, session=sess))  # RGBA
        dt = time.time() - t
        ratio, share, verdict = quality(np.asarray(cut.getchannel("A")))
        cut = trim(cut, pad=4)
        cut.thumbnail((MAX_OUT, MAX_OUT), Image.LANCZOS)
        cut.save(os.path.join(a.out, f"{p['id']}-cutout.png"), optimize=True)
        sticker_style(cut).save(os.path.join(a.out, f"{p['id']}-sticker.png"), optimize=True)
        report[p["id"]] = dict(model=a.model, seconds=round(dt, 2), fg_ratio=round(ratio, 3),
                               largest_component_share=round(share, 3), verdict=verdict)
        print(f"{p['id']:>8}  {verdict:6} fg={ratio:.2f} cc={share:.2f} {dt:.1f}s")
    rp = os.path.join(ROOT, "private", "stickers.report.json")
    json.dump(report, open(rp, "w"), indent=1)
    print("review:", [k for k, v in report.items() if v["verdict"] == "review"])


if __name__ == "__main__":
    sys.exit(main())
