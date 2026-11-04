"""Hand-drawn 1 / 2 / 3 badges for the homepage value cards (2026-11-04).

Each badge is a lopsided crayon-filled circle with a sketchy double outline and a pen-drawn digit, under the
same kind of crayon grain as the logo. Shapes are generated, not typed, so no font is loaded. A fixed seed
keeps the output identical between runs.

Usage (from legal-web/):  python scripts/build-step-badges.py
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "assets" / "steps"
INK = "#2b2320"
BADGES = [  # fill = the card colour used before (--coral, --sun, --mint), line = a darker shade of it
    ("1", "#f57175", "#d9484f"),
    ("2", "#ffd377", "#d79a2b"),
    ("3", "#7dc86f", "#4b9a3f"),
]
DIGITS = {  # pen strokes in a 64 x 64 box, written the way a hand would
    "1": ["M26 24 C29 21 31 19 33.5 16.5", "M33.5 16.5 C33 26 33.4 36 33 46.5"],
    "2": ["M23.5 25 C23 17 40 14 40.5 23.5 C41 30 31 36.5 24.5 45.5 C30 44.6 35.5 44.4 41.5 44.8"],
    "3": ["M24 19.5 C30 14 41.5 16 39.5 24 C38.5 28.6 33 30 29.5 30.4 C35.5 30 42.5 33 41.4 39.5 C40 47.5 28.5 48.5 23 43"],
}


def wobble_circle(rng: random.Random, cx: float, cy: float, r: float, amp: float, start: float, sweep: float,
                  steps: int = 28) -> list[tuple[float, float]]:
    phases = [rng.uniform(0, math.tau) for _ in range(3)]
    pts = []
    for i in range(steps + 1):
        a = start + sweep * i / steps
        k = 1 + amp * (math.sin(2 * a + phases[0]) * 0.6 + math.sin(3 * a + phases[1]) * 0.3
                       + math.sin(5 * a + phases[2]) * 0.1)
        pts.append((cx + r * k * math.cos(a), cy + r * k * math.sin(a)))
    return pts


def smooth(pts: list[tuple[float, float]], closed: bool = False) -> str:
    """Catmull-Rom through the points, written as cubic Beziers."""
    p = pts[:-1] if closed else pts
    n = len(p)
    get = (lambda i: p[i % n]) if closed else (lambda i: p[max(0, min(n - 1, i))])
    d = [f"M{p[0][0]:.2f} {p[0][1]:.2f}"]
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = get(i - 1), get(i), get(i + 1), get(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f"C{c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}")
    return " ".join(d) + (" Z" if closed else "")


def hachure(rng: random.Random, angle: float, gap: float) -> str:
    """Crayon strokes back and forth across the box; the clip path keeps them inside the blob."""
    dx, dy = math.cos(angle), math.sin(angle)
    nx, ny = -dy, dx
    d = []
    for i in range(int(68 / gap) + 1):
        o = -34 + gap * i
        cx, cy = 32 + nx * o, 32 + ny * o
        a = (cx - dx * 40 + rng.uniform(-0.9, 0.9), cy - dy * 40 + rng.uniform(-0.9, 0.9))
        b = (cx + dx * 40 + rng.uniform(-0.9, 0.9), cy + dy * 40 + rng.uniform(-0.9, 0.9))
        if i % 2:
            a, b = b, a
        d.append(f"M{a[0]:.2f} {a[1]:.2f} L{b[0]:.2f} {b[1]:.2f}")
    return " ".join(d)


def badge(digit: str, fill: str, line: str, seed: int) -> str:
    rng = random.Random(seed)
    blob = wobble_circle(rng, 32, 32.5, 24.5, 0.06, 0, math.tau)
    start = rng.uniform(0, math.tau)
    ring_a = wobble_circle(rng, 32, 32.5, 25.5, 0.07, start, math.tau * 1.06)
    ring_b = wobble_circle(rng, 32.6, 32, 24.2, 0.08, start + 2.1, math.tau * 0.93)
    strokes = "".join(f'<path d="{d}"/>' for d in DIGITS[digit])
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs>
<clipPath id="b"><path d="{smooth(blob, closed=True)}"/></clipPath>
<filter id="c" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="{seed}" result="w"/>
<feDisplacementMap in="SourceGraphic" in2="w" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="{seed + 7}" result="g"/>
<feColorMatrix in="g" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3.2 0 0 0 2.75" result="m"/>
<feComposite in="d" in2="m" operator="in"/>
</filter>
</defs>
<g filter="url(#c)" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path clip-path="url(#b)" d="{hachure(rng, math.radians(-38), 3.1)}" stroke="{fill}" stroke-width="3.4"/>
<path d="{smooth(ring_a)}" stroke="{line}" stroke-width="2.1"/>
<path d="{smooth(ring_b)}" stroke="{line}" stroke-width="1.3" opacity="0.8"/>
<g stroke="{INK}" stroke-width="4.4">{strokes}</g>
</g>
</svg>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (digit, fill, line) in enumerate(BADGES):
        path = OUT / f"step-{digit}.svg"
        path.write_text(badge(digit, fill, line, seed=11 + i * 17), encoding="utf-8")
        print(path.name, path.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
