"""Self-hosted fonts for the homepage hero (direction A, 2026-11-04).

The hero headline uses Instrument Serif for Latin scripts and a heavy Noto Serif for CJK. The CJK files only
carry the characters of each locale's hero.title, read from public/assets/site-i18n.js, so each is a few KB.
Fonts are served from postervia.app, never from Google: loading Google Fonts sends visitors' IP addresses to
Google, which a German court held unlawful without consent (LG München I, 3 O 17493/20).

Sources (npm, @expo-google-fonts, all SIL OFL 1.1, no Reserved Font Name), cached in HERO_FONT_CACHE or a temp dir.

Usage (from legal-web/):  python scripts/build-hero-fonts.py
Rerun after hero.title changes in any CJK locale.
"""
import io
import json
import os
import subprocess
import tarfile
import tempfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "fonts" / "hero"
CACHE = Path(os.environ.get("HERO_FONT_CACHE") or Path(tempfile.gettempdir()) / "postervia-hero-font-cache")
TAGLINE = "Find your path. Leave a light."
CJK = {"zh": "noto-serif-sc", "zh-TW": "noto-serif-tc", "ja": "noto-serif-jp", "ko": "noto-serif-kr"}
LATIN = [(0x20, 0x7E), (0xA0, 0x24F), (0x1E00, 0x1EFF), (0x2000, 0x206F), (0x20AC, 0x20AC)]


def npm_font(package: str, suffix: str) -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    tgz = next(CACHE.glob(f"expo-google-fonts-{package}-*.tgz"), None)
    if tgz is None:
        subprocess.run(["npm", "pack", f"@expo-google-fonts/{package}", "--silent"], cwd=CACHE, check=True,
                       shell=os.name == "nt")
        tgz = next(CACHE.glob(f"expo-google-fonts-{package}-*.tgz"))
    with tarfile.open(tgz) as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith(suffix))
        return tar.extractfile(member).read()


def hero_titles() -> dict:
    script = (
        "const s=require('fs').readFileSync(process.argv[1],'utf8');"
        "const a=s.indexOf('const TRANSLATIONS = ')+21,b=s.indexOf('\\n  const RTL_LANGUAGES');"
        "const T=Function('return ('+s.slice(a,b).trim().replace(/;$/,'')+')')();"
        "const o={};for(const[k,v]of Object.entries(T))o[k]=v.hero&&v.hero.title;"
        "process.stdout.write(JSON.stringify(o));"
    )
    out = subprocess.run(["node", "-e", script, str(ROOT / "public/assets/site-i18n.js")], check=True,
                         capture_output=True, text=True, encoding="utf-8")
    return json.loads(out.stdout)


def cut(source: bytes, name: str, unicodes: set[int]) -> tuple[int, int]:
    font = TTFont(io.BytesIO(source))
    cmap = font.getBestCmap()
    missing = sorted(u for u in unicodes if u not in cmap and u > 0x20)
    if missing and name.startswith("hero-serif"):
        raise SystemExit(f"{name}: missing {''.join(chr(u) for u in missing)}")
    opts = subset.Options()
    opts.flavor = "woff"
    opts.layout_features = ["kern", "liga", "locl", "palt", "vpal"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[u for u in unicodes if u in cmap])
    sub.subset(font)
    path = OUT / f"{name}.woff"
    font.flavor = "woff"
    font.save(path)
    return path.stat().st_size, len(missing)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    titles = hero_titles()
    latin = {u for a, b in LATIN for u in range(a, b + 1)}
    print("hero-latin", cut(npm_font("instrument-serif", "InstrumentSerif_400Regular.ttf"), "hero-latin", latin))
    # Titles Instrument Serif cannot fully draw must be in the `html:is(...) .hero h1` system-serif rule in
    # index.html, or the browser mixes two fonts inside one headline. Compare this list with that rule.
    cmap = TTFont(OUT / "hero-latin.woff").getBestCmap()
    system_serif = sorted(k for k, t in titles.items()
                          if t and k not in CJK and any(ord(c) not in cmap for c in t if not c.isspace()))
    print("system-serif headline locales:", " ".join(system_serif))
    print("hero-tagline", cut(npm_font("instrument-serif", "InstrumentSerif_400Regular_Italic.ttf"), "hero-tagline",
                              {ord(c) for c in TAGLINE}))
    for locale, package in CJK.items():
        chars = {ord(c) for c in titles[locale] if not c.isspace()}
        stem = package.removeprefix("noto-serif-")
        suffix = f"NotoSerif{stem.upper()}_900Black.ttf"
        print(f"hero-serif-{stem}", locale, cut(npm_font(package, suffix), f"hero-serif-{stem}", chars))


if __name__ == "__main__":
    main()
