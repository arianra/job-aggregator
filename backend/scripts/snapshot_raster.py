"""G2 snapshot rasterizer (E7.5). Rasterize PDF page 1 at 150dpi and print dims.

Usage: snapshot_raster.py <in.pdf> <out.png> [--diff <baseline.png>]
With --diff: tries to pixel-diff against baseline, prints "diff <fraction>"
(dropped-pixel fraction over the union region). Exit 0 unless a real error.
"""
import sys
import pymupdf

pdf, out = sys.argv[1], sys.argv[2]

doc = pymupdf.open(pdf)
page = doc[0]
print(f"pages {doc.page_count} p0 {page.rect.width:.1f}x{page.rect.height:.1f}")
pix = page.get_pixmap(dpi=150)
pix.save(out)
print(f"png {pix.width}x{pix.height}")

if "--diff" in sys.argv:
    base_path = sys.argv[sys.argv.index("--diff") + 1]
    from PIL import Image
    import numpy as np
    a = np.asarray(Image.open(out).convert("RGB"), dtype=np.int16)
    b = np.asarray(Image.open(base_path).convert("RGB"), dtype=np.int16)
    # union-region diff supporting a size mismatch in height/width
    h = min(a.shape[0], b.shape[0])
    w = min(a.shape[1], b.shape[1])
    union = max(a.shape[0], b.shape[0]) * max(a.shape[1], b.shape[1])
    changed = int((np.abs(a[:h, :w] - b[:h, :w]) > 12).any(axis=2).sum())
    total = h * w
    changed += abs(a.shape[0] - b.shape[0]) * max(a.shape[1], b.shape[1])
    changed += abs(a.shape[1] - b.shape[1]) * min(a.shape[0], b.shape[0])
    fraction = changed / max(1, union)
    print(f"diff {fraction:.6f}")