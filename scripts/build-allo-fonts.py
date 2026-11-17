#!/usr/bin/env python3
"""
Cut the Allo faces @mrmeg/expo-ui bundles from the upstream variable font.

Allo (https://github.com/joshpuckett/allo, SIL OFL 1.1) is one variable font
with three axes: weight, roundness (ROND) and optical size. React Native loads
static files and the kit ships one roundness per sans preset, so this script
pins the axes and writes, for each roundness stop:

  native/Allo<Stop>_<weight>.ttf   four static weights (400, 500, 600, 700)
  web/allo-<stop>-latin.woff2      weight-variable (400 to 700), the Latin range
  web/allo-<stop>-ext.woff2        weight-variable (400 to 700), every other glyph
  web/allo-<stop>.css              @font-face rules for the two files above

plus `web/ranges.json` (the unicode-range of each web file, which
`constants/alloWebFonts.ts` carries a tested copy of) and `OFL.txt`.

Optical size is pinned at 14 (the text design) in every file, so native and web
measure the same. Each stop gets its own family name ("Allo Sharp", …), so two
stops can be registered side by side and neither collides with an "Allo"
installed on the machine.

The outputs are committed. Rerun only when moving to a new upstream release:

  python3 -m venv .venv-fonts
  .venv-fonts/bin/pip install fonttools==4.68.0 brotli==1.2.1
  .venv-fonts/bin/python scripts/build-allo-fonts.py path/to/AlloVariable.ttf path/to/OFL.txt

then update SOURCE_SHA256 and ALLO_VERSION below, copy `web/*.woff2` to
`public/fonts/allo/` and run the tests: `__tests__/webFonts.guardrail.test.ts`
pins the copies, and `packages/ui/src/constants/__tests__/alloWebFonts.test.ts`
and `packages/ui/src/lib/__tests__/alloFonts.test.ts` hold the code to the files.
"""
import hashlib
import io
import json
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ALLO_VERSION = "1.0.1"
SOURCE_SHA256 = "a88d3dd6ce822c22f437ab4b15ef321694d57e13745f42ce5adf14a34569ab67"

OPTICAL_SIZE = 14
STOPS = {"Sharp": 0, "Friendly": 50, "Round": 100}
WEIGHTS = {"Regular": 400, "Medium": 500, "SemiBold": 600, "Bold": 700}
# The web files keep the weight axis, limited to the weights the kit renders:
# a quarter smaller than the full 100 to 900 range.
WEB_WEIGHT_RANGE = (400, 700)

# The range Google Fonts and Fontsource serve as "latin", so the Latin file
# covers what the other self-hosted faces' Latin files cover.
LATIN_RANGE = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,"
    "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
)

OUT = Path(__file__).resolve().parent.parent / "packages/ui/src/fonts/allo"


def parse_range(text):
    codepoints = set()
    for part in text.split(","):
        part = part.strip()[2:]
        if "-" in part:
            start, end = part.split("-")
            codepoints.update(range(int(start, 16), int(end, 16) + 1))
        else:
            codepoints.add(int(part, 16))
    return codepoints


def format_range(codepoints):
    parts = []
    ordered = sorted(codepoints)
    start = previous = ordered[0]
    for codepoint in ordered[1:] + [None]:
        if codepoint is not None and codepoint == previous + 1:
            previous = codepoint
            continue
        parts.append(f"U+{start:04X}" if start == previous else f"U+{start:04X}-{previous:04X}")
        if codepoint is not None:
            start = previous = codepoint
    return ",".join(parts)


def set_names(font, family, style, variable=False):
    """Give a cut its own family, so stops never share a PostScript name."""
    ribbi = style in ("Regular", "Bold")
    postscript = f"{family.replace(' ', '')}-{'Variable' if variable else style}"
    full = family if variable else f"{family} {style}"
    values = {
        1: family if ribbi or variable else f"{family} {style}",
        2: "Regular" if variable or not ribbi else style,
        3: f"{ALLO_VERSION};{postscript}",
        4: full,
        6: postscript,
    }
    name = font["name"]
    for name_id in (16, 17, 25):
        name.removeNames(nameID=name_id)
    if not ribbi and not variable:
        values[16] = family
        values[17] = style
    if variable:
        values[25] = family.replace(" ", "")
    for name_id, value in values.items():
        name.removeNames(nameID=name_id)
        name.setName(value, name_id, 3, 1, 0x409)
        name.setName(value, name_id, 1, 0, 0)


def set_weight_bits(font, weight):
    font["OS/2"].usWeightClass = weight
    selection = font["OS/2"].fsSelection & ~0b1100001  # clear italic, bold, regular
    font["OS/2"].fsSelection = selection | (1 << 5 if weight == 700 else 1 << 6 if weight == 400 else 0)
    font["head"].macStyle = 1 if weight == 700 else 0


def load(source):
    return TTFont(io.BytesIO(source), recalcTimestamp=False)


def save(font, path, flavor=None):
    font.flavor = flavor
    font.save(path)


def subset_to(font, codepoints):
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.glyph_names = False
    options.drop_tables = []
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    return font


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: build-allo-fonts.py <AlloVariable.ttf> <OFL.txt>")
    source = Path(sys.argv[1]).read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    if digest != SOURCE_SHA256:
        sys.exit(f"AlloVariable.ttf is not the pinned {ALLO_VERSION} file (sha256 {digest}).")

    for folder in ("native", "web"):
        shutil.rmtree(OUT / folder, ignore_errors=True)
        (OUT / folder).mkdir(parents=True)
    shutil.copyfile(sys.argv[2], OUT / "OFL.txt")

    covered = set(load(source).getBestCmap())
    latin = parse_range(LATIN_RANGE) & covered
    ext = covered - latin
    ranges = {"latin": LATIN_RANGE, "ext": format_range(ext)}

    for stop, roundness in STOPS.items():
        family = f"Allo {stop}"
        slug = stop.lower()

        for style, weight in WEIGHTS.items():
            static = instancer.instantiateVariableFont(
                load(source), {"opsz": OPTICAL_SIZE, "ROND": roundness, "wght": weight}
            )
            set_names(static, family, style)
            set_weight_bits(static, weight)
            save(static, OUT / "native" / f"Allo{stop}_{weight}{style}.ttf")

        for subset_name, codepoints in (("latin", latin), ("ext", ext)):
            variable = instancer.instantiateVariableFont(
                load(source), {"opsz": OPTICAL_SIZE, "ROND": roundness, "wght": WEB_WEIGHT_RANGE}
            )
            set_names(variable, family, "Regular", variable=True)
            # The instancer drops gvar entries for glyphs left with no deltas and
            # the subsetter expects one per glyph: a save and reload restores them.
            buffer = io.BytesIO()
            variable.save(buffer)
            variable = load(buffer.getvalue())
            subset_to(variable, codepoints)
            save(variable, OUT / "web" / f"allo-{slug}-{subset_name}.woff2", flavor="woff2")

        css = "".join(
            f'@font-face{{font-family:"{family}";font-style:normal;font-weight:{WEB_WEIGHT_RANGE[0]} {WEB_WEIGHT_RANGE[1]};'
            f'font-display:swap;src:url(./allo-{slug}-{subset_name}.woff2) format("woff2");'
            f"unicode-range:{ranges[subset_name]}}}\n"
            for subset_name in ("ext", "latin")
        )
        (OUT / "web" / f"allo-{slug}.css").write_text(
            f"/* {family}: Allo {ALLO_VERSION} at roundness {roundness}, optical size {OPTICAL_SIZE}. "
            f"SIL Open Font License 1.1. https://github.com/joshpuckett/allo */\n{css}"
        )

    (OUT / "web" / "ranges.json").write_text(json.dumps(ranges, indent=2) + "\n")
    for path in sorted(OUT.rglob("*")):
        if path.is_file():
            print(f"{path.stat().st_size:>8}  {path.relative_to(OUT)}")


if __name__ == "__main__":
    main()
