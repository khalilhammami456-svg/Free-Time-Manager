# notebook-assets/

Asset pipeline for the notebook project. **Public-safe contents only are tracked** (tools, original lily artwork). Everything personal is gitignored.

| Path | Tracked? | What |
|---|---|---|
| `flowers/` | ✅ | 10 original blue-lily SVGs + `manifest.json` (source: `tools/make_lilies.py`, licence CC0). Palette = spec blue tokens. |
| `tools/make_lilies.py` | ✅ | Deterministic (seeded) lily generator. `python tools/make_lilies.py` |
| `tools/make_stickers.py` | ✅ | Local rembg pipeline: rotate → cut-out → harden matte → white die-cut border + shadow. Reads the private manifest. |
| `tools/fetch_models.sh` | ✅ | Downloads ONNX models from the upstream rembg release and verifies pinned SHA-256 (`FULL=1` adds the 176 MB model). |
| `tools/poc-integration/` | ✅ | Throw-away Vite+React 19 test of react-pageflip + Fabric 7 + rembg-web + idb-keyval (see `design-research/NOTEBOOK_BUILD_FINDINGS.md`). |
| `source/` | 🚫 private | The author's 41 original photos + the spec PDF. |
| `private/` | 🚫 private | Photo manifest, sticker report, full spec digest. |
| `stickers-private/` | 🚫 private | Generated cut-outs/stickers (`silueta/`, `human_seg/` raw sets; `final/` = reviewed picks). |
| `models/` | 🚫 binaries | Downloaded ONNX models (re-fetch with the script). |

## Why a public repo holds a private pipeline
The repo `Free-Time-Manager` is **public**. Move the notebook into a new **private** repository before committing any photo, letter, manifest or sticker. Until then `.gitignore` blocks the private folders; double-check with `git status` before every commit.

## Regenerate everything
```sh
python3 -m venv .venv && . .venv/bin/activate
pip install rembg onnxruntime pillow numpy scipy
tools/fetch_models.sh models && FULL=1 tools/fetch_models.sh models   # FULL=1 only if you want the large model
U2NET_HOME=./models python tools/make_stickers.py --model silueta        --out stickers-private/silueta
U2NET_HOME=./models python tools/make_stickers.py --model u2net_human_seg --out stickers-private/human_seg
python tools/make_lilies.py
```
(`rembg` looks for `U2NET_HOME/models/<name>/<name>.onnx`; if you used `fetch_models.sh`, place/copy files accordingly or let rembg download them itself.)
