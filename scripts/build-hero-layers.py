"""Split the hero logo drawing into layers for the intro animation (2026-11-04).

Reads public/assets/hero/path-coral.png (the coral line art cut from the app icon) and writes five same-size
PNGs next to it, so index.html can stack them and animate each part: arch, path, star, dots-a, dots-b.
Parts are found by connected components; the path is whatever lies between the pillars below the star,
plus the ground lines at the bottom. Rerun after path-coral.png changes.

Usage (from legal-web/):  python scripts/build-hero-layers.py
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERO = Path(__file__).resolve().parents[1] / "public" / "assets" / "hero"
PILLAR_LEFT, PILLAR_RIGHT = 102, 400  # inner edges of the pillars, measured on path-coral.png
PATH_TOP, GROUND_TOP = 285, 586


def main() -> None:
    rgba = np.array(Image.open(HERO / "path-coral.png").convert("RGBA"))
    ink = rgba[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(rgba[..., 3] > 24, iterations=4))
    lab = np.where(ink, lab, 0)
    sizes = ndimage.sum(ink, lab, range(1, n + 1))
    centres = ndimage.center_of_mass(ink, lab, range(1, n + 1))

    star_label = 1 + int(np.argsort(sizes)[-2])  # biggest part is arch + path (they touch), second is the star
    dot_labels = [i + 1 for i in range(n) if sizes[i] < 200 and centres[i][0] < 330 and i + 1 != star_label]

    ys, xs = np.mgrid[: ink.shape[0], : ink.shape[1]]
    star = lab == star_label
    dots = np.isin(lab, dot_labels)
    between = (xs >= PILLAR_LEFT) & (xs <= PILLAR_RIGHT) & (ys >= PATH_TOP)
    path = ink & ~star & ~dots & (between | (ys >= GROUND_TOP))
    arch = ink & ~star & ~dots & ~path
    order = sorted(dot_labels, key=lambda i: centres[i - 1][1])  # alternate left to right
    dots_a = np.isin(lab, order[0::2])
    dots_b = np.isin(lab, order[1::2])

    for name, mask in [("arch", arch), ("path", path), ("star", star), ("dots-a", dots_a), ("dots-b", dots_b)]:
        layer = rgba.copy()
        layer[~mask, 3] = 0
        layer[~mask, :3] = 0
        out = HERO / f"logo-{name}.png"
        Image.fromarray(layer).save(out, optimize=True)
        print(out.name, out.stat().st_size, "bytes")

    rows = np.where(star.any(axis=1))[0]
    widest = rows[np.argmax([star[r].sum() for r in rows])]
    cols = np.where(star[widest])[0]
    print(f"star centre for transform-origin: {cols.mean() / ink.shape[1]:.1%} {widest / ink.shape[0]:.1%}")
    print("dots:", len(dot_labels))


if __name__ == "__main__":
    main()
