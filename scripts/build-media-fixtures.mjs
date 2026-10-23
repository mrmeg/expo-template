#!/usr/bin/env node
/**
 * Media fixture generator: rebuilds the Media Lab corpus from nothing.
 *
 * Every file comes from a synthetic source (lavfi `testsrc2`, `smptehdbars`,
 * `mandelbrot`, `sine`, `anullsrc`, geq/hue filters, hand-written bytes), so the
 * repo carries no third-party media. Two tiers:
 *
 *   core       `assets/media/`           small, opaque, committed; gallery previews use it
 *   generated  `public/media-fixtures/`  large and gitignored; built on demand
 *
 * Usage:
 *   bun run media:fixtures                  build the generated tier
 *   bun run media:fixtures --core           rebuild only the committed core
 *   bun run media:fixtures --only a,b,pfx*  build a subset (core or generated ids; `*` suffix = prefix)
 *   bun run media:fixtures --list [--json]  print every fixture with its tools and status; build nothing
 *
 * ffmpeg is required for almost everything; avifenc, cwebp, img2webp, cjpeg and
 * macOS `sips` each cover a few fixtures. A fixture whose tool is missing is
 * skipped with a warning and the run keeps going. The summary table at the end
 * shows what was built, what was skipped and why, and the total size.
 *
 * Output is not byte-stable across encoder versions and `sips` is macOS-only, so
 * this script stays out of `bun run gen` and `bun run verify`. The ids and output
 * paths below are the contract `client/showcase/mediaFixtures.ts` is tested
 * against (`client/showcase/__tests__/mediaFixtures.test.ts` reads `--list --json`).
 */
import { spawnSync } from "node:child_process";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CORE_DIR = "assets/media";
const GENERATED_DIR = "public/media-fixtures";
/** The committed core stays under this (decimal MB, so a file manager agrees). */
const CORE_BUDGET_BYTES = 2_500_000;

const P3_PROFILE = "/System/Library/ColorSync/Profiles/Display P3.icc";
const CMYK_PROFILE = "/System/Library/ColorSync/Profiles/Generic CMYK Profile.icc";

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

/** Thrown from a build or verify step to skip (not fail) a fixture. */
class Skip extends Error {}

const FIXTURES = [];

/**
 * Declare one fixture once: id, output path, required tools, and the build.
 *
 * `tools` entries are executables (`ffmpeg`, `cwebp`, …), ffmpeg encoders
 * (`ffmpeg:libx265`) or files (`file:/path`). `build(ctx)` writes `ctx.out`.
 * `verify(ctx)` may throw to fail the fixture, or `Skip` to drop it with a reason.
 */
function declare({ id, tier, dir, file, tools = [], build, verify }) {
  FIXTURES.push({
    id,
    tier,
    kind: kindOf(dir ?? file),
    out: tier === "core" ? `${CORE_DIR}/${file}` : `${GENERATED_DIR}/${dir}/${file}`,
    tools,
    build,
    verify,
  });
}

function kindOf(dir) {
  if (dir.startsWith("images") || /\.(jpe?g|png)$/.test(dir)) return "image";
  if (dir.startsWith("video") || dir.endsWith(".mp4")) return "video";
  return "audio";
}

const core = (id, file, def) => declare({ id, tier: "core", file, ...def });
const generated = (id, dir, file, def) => declare({ id, tier: "generated", dir, file, ...def });
const image = (id, file, def) => generated(id, "images", file, def);
const video = (id, file, def) => generated(id, "video", file, def);
const audio = (id, file, def) => generated(id, "audio", file, def);

// ffmpeg argument fragments ------------------------------------------------

const lavfi = (spec) => ["-f", "lavfi", "-i", spec];
const testsrc2 = (w, h, rate = 30) => lavfi(`testsrc2=size=${w}x${h}:rate=${rate}`);
const sine = (freq = 440, extra = "") => lavfi(`sine=frequency=${freq}:sample_rate=44100${extra}`);
const stillFrame = ["-frames:v", "1"];

/** One lavfi frame to a JPEG (or PNG, by extension of `ctx.out`). */
const still = (src, { vf, quality = 3 } = {}) => (c) =>
  c.ffmpeg([...src, ...(vf ? ["-vf", vf] : []), ...stillFrame, "-q:v", String(quality), c.out]);

/** H.264 + AAC clip with the common 4:2:0 settings. */
const h264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast"];

const ALPHA_VF = (size) =>
  `format=gbrap,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip(255*(${Math.round(size * 0.38)}-hypot(X-${size / 2},Y-${size / 2})),0,255)',format=rgba`;

// --- Core (assets/media, committed) ----------------------------------------

core("core-landscape", "landscape.jpg", {
  tools: ["ffmpeg"],
  // smptehdbars has distinct top (bars) and bottom (PLUGE) bands, so an
  // `objectPosition` crop of a 16:9 source is visible in a square box.
  build: still(lavfi("smptehdbars=size=1600x900"), { quality: 3 }),
});
core("core-portrait", "portrait.jpg", {
  tools: ["ffmpeg"],
  build: still(testsrc2(900, 1600), { quality: 4 }),
});
core("core-square", "square.jpg", {
  tools: ["ffmpeg"],
  build: still(lavfi("mandelbrot=size=1024x1024:rate=1:start_scale=0.6:start_x=-0.75:start_y=0.1"), { quality: 5 }),
});
core("core-alpha", "alpha.png", {
  tools: ["ffmpeg"],
  // Transparent background, opaque disc with a 1px anti-aliased edge.
  build: (c) => c.ffmpeg([...testsrc2(512, 512), "-vf", ALPHA_VF(512), ...stillFrame, c.out]),
  verify: (c) => c.expectProbe((s) => (s.pix_fmt === "rgba" ? null : `pix_fmt ${s.pix_fmt}, expected rgba`)),
});
core("core-video-landscape", "landscape.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  build: (c) =>
    c.ffmpeg([
      ...testsrc2(640, 360), ...sine(440),
      "-t", "10",
      "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0", "-pix_fmt", "yuv420p",
      "-b:v", "330k", "-maxrate", "400k", "-bufsize", "800k", "-g", "60",
      "-c:a", "aac", "-b:a", "64k", "-ac", "1",
      "-movflags", "+faststart", c.out,
    ]),
  verify: (c) => c.expectMoovFirst(),
});
core("core-video-portrait", "portrait.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  build: (c) =>
    c.ffmpeg([
      ...testsrc2(360, 640), ...sine(660),
      "-t", "10",
      "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0", "-pix_fmt", "yuv420p",
      "-b:v", "330k", "-maxrate", "400k", "-bufsize", "800k", "-g", "60",
      "-c:a", "aac", "-b:a", "64k", "-ac", "1",
      "-movflags", "+faststart", c.out,
    ]),
  verify: (c) => c.expectMoovFirst(),
});
core("core-tone", "tone.m4a", {
  tools: ["ffmpeg", "ffmpeg:aac"],
  // A beep every second makes progress and seeking audible.
  build: (c) =>
    c.ffmpeg([...lavfi("sine=frequency=523:sample_rate=44100:beep_factor=4:duration=20"), "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", c.out]),
});

// --- Generated images -------------------------------------------------------

// Aspect and size.
for (const [slug, w, h] of [
  ["21x9", 2100, 900],
  ["3x1", 1800, 600],
  ["1x3", 400, 1200],
  ["4x3", 1200, 900],
  ["3x4", 900, 1200],
]) {
  image(`img-aspect-${slug}`, `aspect-${slug}.jpg`, { tools: ["ffmpeg"], build: still(testsrc2(w, h)) });
}
image("img-size-16", "size-16.png", { tools: ["ffmpeg"], build: (c) => c.ffmpeg([...testsrc2(16, 16), ...stillFrame, c.out]) });
image("img-size-48", "size-48.png", { tools: ["ffmpeg"], build: (c) => c.ffmpeg([...testsrc2(48, 48), ...stillFrame, c.out]) });
image("img-size-48mp", "size-48mp.jpg", {
  tools: ["ffmpeg"],
  build: still(testsrc2(8000, 6000), { quality: 8 }),
  verify: (c) => c.expectProbe((s) => (s.width === 8000 && s.height === 6000 ? null : `${s.width}x${s.height}`)),
});

// Formats.
image("img-fmt-jpeg-baseline", "fmt-jpeg-baseline.jpg", { tools: ["ffmpeg"], build: still(testsrc2(1200, 800)) });
image("img-fmt-jpeg-progressive", "fmt-jpeg-progressive.jpg", {
  tools: ["ffmpeg", "cjpeg"],
  build: (c) => {
    const ppm = c.tmp("src.ppm");
    c.ffmpeg([...testsrc2(1200, 800), ...stillFrame, ppm]);
    c.run("cjpeg", ["-progressive", "-quality", "85", "-outfile", c.out, ppm]);
  },
  verify: (c) => {
    if (!isProgressiveJpeg(readFileSync(c.out))) throw new Error("no SOF2 marker: JPEG is not progressive");
  },
});
image("img-fmt-png-opaque", "fmt-png-opaque.png", { tools: ["ffmpeg"], build: (c) => c.ffmpeg([...testsrc2(800, 600), ...stillFrame, c.out]) });
image("img-fmt-png-alpha", "fmt-png-alpha.png", {
  tools: ["ffmpeg"],
  build: (c) => c.ffmpeg([...testsrc2(640, 640), "-vf", ALPHA_VF(640), ...stillFrame, c.out]),
  verify: (c) => c.expectProbe((s) => (s.pix_fmt === "rgba" ? null : `pix_fmt ${s.pix_fmt}`)),
});
image("img-fmt-png-16bit", "fmt-png-16bit.png", {
  tools: ["ffmpeg"],
  build: (c) => c.ffmpeg([...lavfi("gradients=size=640x360:n=4:seed=7"), ...stillFrame, "-pix_fmt", "rgb48be", c.out]),
  verify: (c) => c.expectProbe((s) => (s.pix_fmt === "rgb48be" ? null : `pix_fmt ${s.pix_fmt}`)),
});
image("img-fmt-webp-lossy", "fmt-webp-lossy.webp", {
  tools: ["ffmpeg", "cwebp"],
  build: (c) => {
    const png = c.tmp("src.png");
    c.ffmpeg([...testsrc2(1200, 800), ...stillFrame, png]);
    c.run("cwebp", ["-quiet", "-q", "80", png, "-o", c.out]);
  },
});
image("img-fmt-webp-lossless-alpha", "fmt-webp-lossless-alpha.webp", {
  tools: ["ffmpeg", "cwebp"],
  build: (c) => {
    const png = c.tmp("src.png");
    c.ffmpeg([...testsrc2(640, 640), "-vf", ALPHA_VF(640), ...stillFrame, png]);
    c.run("cwebp", ["-quiet", "-lossless", png, "-o", c.out]);
  },
});
image("img-fmt-avif", "fmt-avif.avif", {
  tools: ["ffmpeg", "avifenc"],
  build: (c) => {
    const png = c.tmp("src.png");
    c.ffmpeg([...testsrc2(1200, 800), ...stillFrame, png]);
    c.run("avifenc", ["-q", "60", "-s", "8", png, c.out]);
  },
});
image("img-fmt-gif-animated", "fmt-gif-animated.gif", {
  tools: ["ffmpeg"],
  // The duration is on the source, not `-t`: palettegen only emits once its
  // input ends, and an output-side `-t` never ends a lavfi source (it hangs).
  build: (c) =>
    c.ffmpeg([
      ...lavfi("testsrc2=size=320x240:rate=10:duration=2"),
      "-vf", "split[a][b];[a]palettegen[p];[b][p]paletteuse",
      "-loop", "0", c.out,
    ]),
  verify: (c) => c.expectProbe((s) => (s.codec_name === "gif" ? null : `codec ${s.codec_name}`)),
});
image("img-fmt-webp-animated", "fmt-webp-animated.webp", {
  tools: ["ffmpeg", "img2webp"],
  build: (c) => {
    const frames = [];
    for (let i = 0; i < 12; i += 1) {
      const frame = c.tmp(`frame-${String(i).padStart(2, "0")}.png`);
      c.ffmpeg([...testsrc2(320, 240, 12), "-vf", `select='eq(n,${i * 3})'`, ...stillFrame, frame]);
      frames.push(frame);
    }
    c.run("img2webp", ["-loop", "0", "-d", "100", "-lossy", "-q", "70", ...frames, "-o", c.out]);
  },
});
image("img-fmt-apng", "fmt-apng.png", {
  tools: ["ffmpeg"],
  build: (c) => c.ffmpeg([...testsrc2(320, 240, 10), "-t", "2", "-plays", "0", "-f", "apng", c.out]),
});
image("img-fmt-svg-viewbox", "fmt-svg-viewbox.svg", {
  build: (c) => writeFileSync(c.out, svgDoc({ viewBoxOnly: true })),
});
image("img-fmt-svg-fixed", "fmt-svg-fixed.svg", {
  build: (c) => writeFileSync(c.out, svgDoc({ viewBoxOnly: false })),
});
image("img-fmt-heic", "fmt-heic.heic", {
  tools: ["ffmpeg", "sips"],
  build: (c) => {
    const png = c.tmp("src.png");
    c.ffmpeg([...testsrc2(1200, 800), ...stillFrame, png]);
    c.run("sips", ["-s", "format", "heic", png, "--out", c.out]);
  },
});

// Orientation: landscape pixels, EXIF Orientation 6 (rotate 90 clockwise to display).
image("img-orient-exif6", "orient-exif6.jpg", {
  tools: ["ffmpeg"],
  build: (c) => {
    const base = c.tmp("src.jpg");
    c.ffmpeg([...testsrc2(800, 450), ...stillFrame, "-q:v", "3", base]);
    writeFileSync(c.out, withExifOrientation(readFileSync(base), 6));
  },
  // `sips -g orientation` reports <nil> for any JPEG on current macOS, so read
  // the tag back through ffprobe: ffmpeg turns EXIF Orientation 6 into a
  // display matrix on the decoded frame (rotation -90 = rotate 90 clockwise).
  verify: (c) => {
    if (!c.has("ffprobe")) return;
    const frames = c.run("ffprobe", ["-v", "error", "-show_frames", "-of", "default=nw=1", c.out]);
    if (!/rotation=-90/.test(frames)) throw new Error("ffprobe did not read EXIF Orientation 6 as a -90 display rotation");
  },
});

// Color.
image("img-color-p3", "color-p3.jpg", {
  tools: ["ffmpeg", "sips", `file:${P3_PROFILE}`],
  build: (c) => {
    const base = c.tmp("src.jpg");
    c.ffmpeg([...testsrc2(1200, 800), ...stillFrame, "-q:v", "3", base]);
    c.run("sips", ["-m", P3_PROFILE, base, "--out", c.out]);
  },
  verify: (c) => sipsExpect(c, /profile: Display P3/, "no Display P3 profile embedded"),
});
image("img-color-gray", "color-gray.jpg", {
  tools: ["ffmpeg", "cjpeg"],
  // ffmpeg's mjpeg encoder always writes YCbCr, so only `cjpeg -grayscale`
  // produces a true single-component JPEG.
  build: (c) => {
    const ppm = c.tmp("src.ppm");
    c.ffmpeg([...testsrc2(1200, 800), ...stillFrame, ppm]);
    c.run("cjpeg", ["-grayscale", "-quality", "85", "-outfile", c.out, ppm]);
  },
  verify: (c) => {
    if (c.has("sips")) sipsExpect(c, /space: Gray/i, "JPEG is not single-component gray");
  },
});
image("img-color-cmyk", "color-cmyk.jpg", {
  tools: ["ffmpeg", "sips", `file:${CMYK_PROFILE}`],
  build: (c) => {
    const base = c.tmp("src.jpg");
    c.ffmpeg([...testsrc2(1200, 800), ...stillFrame, "-q:v", "3", base]);
    c.run("sips", ["-s", "format", "jpeg", "-m", CMYK_PROFILE, base, "--out", c.out]);
  },
  // Never ship an RGB file labelled CMYK: drop the fixture if sips did not write one.
  verify: (c) => {
    try {
      sipsExpect(c, /space: CMYK/, "sips did not write a CMYK JPEG");
    } catch (error) {
      throw new Skip(error.message);
    }
  },
});

// Responsive: one picture at three widths, tinted so the chosen `source` entry is visible.
for (const [width, hue] of [[400, 0], [800, 120], [1600, 240]]) {
  // Even heights: the YUV 4:2:0 pipeline rounds an odd one (225) down anyway.
  const height = Math.floor((width * 9) / 16 / 2) * 2;
  image(`img-responsive-${width}`, `responsive-${width}.jpg`, {
    tools: ["ffmpeg"],
    build: still(testsrc2(width, height), { vf: `hue=h=${hue}` }),
  });
}

// List scale: 60 distinct 256x256 thumbnails (different frame, different hue).
for (let n = 1; n <= 60; n += 1) {
  const label = String(n).padStart(2, "0");
  image(`img-scale-${label}`, `scale-${label}.jpg`, {
    tools: ["ffmpeg"],
    build: still(testsrc2(256, 256, 25), { vf: `select='eq(n,${n * 7})',hue=h=${n * 6}`, quality: 5 }),
  });
}

// Broken: each must reach a component's error state (or, for PNG-as-JPG, decode anyway).
image("img-broken-truncated", "broken-truncated.jpg", {
  tools: ["ffmpeg"],
  build: (c) => {
    const base = c.tmp("src.jpg");
    c.ffmpeg([...testsrc2(1200, 800), ...stillFrame, "-q:v", "3", base]);
    const bytes = readFileSync(base);
    writeFileSync(c.out, bytes.subarray(0, Math.floor(bytes.length / 2)));
  },
});
image("img-broken-zero", "broken-zero.jpg", { build: (c) => writeFileSync(c.out, "") });
image("img-broken-png-as-jpg", "broken-png-as-jpg.jpg", {
  tools: ["ffmpeg"],
  // Valid PNG bytes under a .jpg name: decoders sniff content, so this should still render.
  build: (c) => c.ffmpeg([...testsrc2(640, 360), ...stillFrame, "-f", "image2", "-update", "1", "-c:v", "png", c.out]),
  verify: (c) => {
    const head = readFileSync(c.out).subarray(0, 8).toString("hex");
    if (head !== "89504e470d0a1a0a") throw new Error("not PNG bytes");
  },
});
image("img-broken-text-as-png", "broken-text-as-png.png", {
  build: (c) => writeFileSync(c.out, "This is not an image.\nIt is plain text saved with a .png extension.\n"),
});

// --- Generated video --------------------------------------------------------

const clip = (w, h, { dur = 3, rate = 30, hz = 440, vcodec = h264, acodec = ["-c:a", "aac", "-b:a", "64k"], crf = "30", extra = [] } = {}) =>
  (c) => c.ffmpeg([...testsrc2(w, h, rate), ...sine(hz), "-t", String(dur), ...vcodec, "-crf", crf, ...acodec, ...extra, c.out]);

for (const [slug, w, h] of [["1x1", 480, 480], ["4x3", 640, 480], ["21x9", 840, 360]]) {
  video(`vid-aspect-${slug}`, `aspect-${slug}.mp4`, {
    tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
    build: clip(w, h, { extra: ["-movflags", "+faststart"] }),
  });
}
video("vid-rotate-90", "rotate-90.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  // Coded 640x360 landscape, flagged with a 90 degree display matrix: a player
  // that honors it shows 360x640 portrait.
  build: (c) => {
    const base = c.tmp("landscape.mp4");
    clip(640, 360, { dur: 4, extra: ["-movflags", "+faststart"] })({ ...c, out: base });
    c.ffmpeg(["-display_rotation", "90", "-i", base, "-c", "copy", "-movflags", "+faststart", c.out]);
  },
  verify: (c) =>
    c.expectProbe((s) => {
      const rotated = (s.side_data_list ?? []).some((d) => Math.abs(Number(d.rotation)) === 90) || Math.abs(Number(s.tags?.rotate)) === 90;
      return rotated ? null : "no display rotation in side data or rotate tag";
    }),
});
video("vid-tracks-no-audio", "tracks-no-audio.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264"],
  build: (c) => c.ffmpeg([...testsrc2(640, 360), "-t", "4", ...h264, "-crf", "30", "-an", "-movflags", "+faststart", c.out]),
  verify: (c) => c.expectStreams({ video: 1, audio: 0 }),
});
video("vid-tracks-audio-only", "tracks-audio-only.mp4", {
  tools: ["ffmpeg", "ffmpeg:aac"],
  build: (c) => c.ffmpeg([...sine(440), "-t", "5", "-vn", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", c.out]),
  verify: (c) => c.expectStreams({ video: 0, audio: 1 }),
});
video("vid-dur-loop-2s", "dur-loop-2s.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  build: clip(480, 270, { dur: 2, extra: ["-movflags", "+faststart"] }),
});
video("vid-dur-1h05", "dur-1h05.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264"],
  // 3900 s at 1 fps, no audio track (3900 s of even 16 kb/s AAC alone would be ~7.8 MB).
  build: (c) =>
    c.ffmpeg([
      ...testsrc2(64, 36, 1), "-t", "3900",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "40", "-g", "120", "-an",
      "-movflags", "+faststart", c.out,
    ]),
  verify: (c) => {
    c.expectSize({ max: 3_000_000 });
    c.expectDuration(3900);
  },
});
video("vid-codec-h264-high-1080p", "codec-h264-high-1080p.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  build: clip(1920, 1080, { vcodec: [...h264, "-profile:v", "high", "-level", "4.0"], extra: ["-movflags", "+faststart"] }),
});
video("vid-codec-hevc", "codec-hevc.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx265", "ffmpeg:aac"],
  build: clip(640, 360, {
    vcodec: ["-c:v", "libx265", "-tag:v", "hvc1", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-x265-params", "log-level=error"],
    crf: "30", extra: ["-movflags", "+faststart"],
  }),
});
video("vid-codec-hevc-10bit", "codec-hevc-10bit.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx265", "ffmpeg:aac"],
  build: clip(640, 360, {
    vcodec: ["-c:v", "libx265", "-tag:v", "hvc1", "-pix_fmt", "yuv420p10le", "-profile:v", "main10", "-preset", "veryfast", "-x265-params", "log-level=error"],
    crf: "30", extra: ["-movflags", "+faststart"],
  }),
  verify: (c) => c.expectProbe((s) => (s.pix_fmt === "yuv420p10le" ? null : `pix_fmt ${s.pix_fmt}`)),
});
video("vid-codec-vp9-opus-webm", "codec-vp9-opus.webm", {
  tools: ["ffmpeg", "ffmpeg:libvpx-vp9", "ffmpeg:libopus"],
  build: clip(640, 360, {
    vcodec: ["-c:v", "libvpx-vp9", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "6", "-row-mt", "1", "-pix_fmt", "yuv420p"],
    acodec: ["-c:a", "libopus", "-b:a", "64k"], crf: "36",
  }),
});
video("vid-codec-av1-mp4", "codec-av1.mp4", {
  tools: ["ffmpeg", "ffmpeg:libsvtav1", "ffmpeg:aac"],
  build: clip(640, 360, {
    vcodec: ["-c:v", "libsvtav1", "-pix_fmt", "yuv420p", "-preset", "10"],
    crf: "40", extra: ["-movflags", "+faststart"],
  }),
});
video("vid-codec-av1-webm", "codec-av1.webm", {
  tools: ["ffmpeg", "ffmpeg:libsvtav1", "ffmpeg:libopus"],
  build: clip(640, 360, {
    vcodec: ["-c:v", "libsvtav1", "-pix_fmt", "yuv420p", "-preset", "10"],
    acodec: ["-c:a", "libopus", "-b:a", "64k"], crf: "40",
  }),
});
video("vid-codec-h264-mov", "codec-h264.mov", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  build: clip(640, 360, { extra: ["-movflags", "+faststart"] }),
});
video("vid-codec-60fps", "codec-60fps.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  build: clip(640, 360, { rate: 60, extra: ["-r", "60", "-movflags", "+faststart"] }),
  verify: (c) => c.expectProbe((s) => (s.r_frame_rate === "60/1" ? null : `r_frame_rate ${s.r_frame_rate}`)),
});
video("vid-codec-4k", "codec-4k.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  build: clip(3840, 2160, { vcodec: [...h264, "-profile:v", "high", "-level", "5.1"], crf: "32", extra: ["-movflags", "+faststart"] }),
});
video("vid-container-moov-end", "container-moov-end.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  // No +faststart: the moov atom is written after mdat, so playback cannot start
  // until the whole ~5 MB file (or a range request for its tail) arrives.
  build: (c) =>
    c.ffmpeg([
      ...testsrc2(1280, 720), ...sine(440), "-t", "20",
      ...h264, "-b:v", "1900k", "-maxrate", "2200k", "-bufsize", "4000k",
      "-c:a", "aac", "-b:a", "96k", c.out,
    ]),
  verify: (c) => c.expectMoovLast(),
});
video("vid-container-fragmented", "container-fragmented.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  build: clip(640, 360, {
    dur: 6, extra: ["-g", "30", "-movflags", "frag_keyframe+empty_moov+default_base_moof"],
  }),
});
video("vid-broken-truncated", "broken-truncated.mp4", {
  tools: ["ffmpeg", "ffmpeg:libx264", "ffmpeg:aac"],
  // The moov atom is last, so cutting the file in half removes it: unplayable.
  build: (c) => {
    const base = c.tmp("src.mp4");
    clip(640, 360, { dur: 4 })({ ...c, out: base });
    const bytes = readFileSync(base);
    writeFileSync(c.out, bytes.subarray(0, Math.floor(bytes.length / 2)));
  },
});
video("vid-broken-zero", "broken-zero.mp4", { build: (c) => writeFileSync(c.out, "") });
video("vid-broken-text", "broken-text.mp4", {
  build: (c) => writeFileSync(c.out, "This is not a video.\nIt is plain text saved with an .mp4 extension.\n"),
});

// --- Generated audio --------------------------------------------------------

audio("aud-fmt-mp3-cbr", "fmt-mp3-cbr.mp3", {
  tools: ["ffmpeg", "ffmpeg:libmp3lame"],
  build: (c) => c.ffmpeg([...sine(440), "-t", "10", "-c:a", "libmp3lame", "-b:a", "128k", c.out]),
});
audio("aud-fmt-mp3-vbr", "fmt-mp3-vbr.mp3", {
  tools: ["ffmpeg", "ffmpeg:libmp3lame"],
  // Noise then tone so the VBR bitrate really varies, and no Xing/Info header:
  // players must estimate duration from the first frames, the known edge.
  build: (c) =>
    c.ffmpeg([
      ...lavfi("anoisesrc=color=pink:amplitude=0.3:sample_rate=44100:duration=4"),
      ...lavfi("sine=frequency=330:sample_rate=44100:duration=8"),
      "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]", "-map", "[a]",
      "-c:a", "libmp3lame", "-q:a", "4", "-write_xing", "0", c.out,
    ]),
});
audio("aud-fmt-wav", "fmt-wav.wav", {
  tools: ["ffmpeg"],
  build: (c) => c.ffmpeg([...sine(440), "-t", "5", "-c:a", "pcm_s16le", "-ac", "2", c.out]),
});
audio("aud-fmt-flac", "fmt-flac.flac", {
  tools: ["ffmpeg", "ffmpeg:flac"],
  build: (c) => c.ffmpeg([...sine(440), "-t", "5", "-c:a", "flac", "-ac", "2", c.out]),
});
audio("aud-fmt-ogg-opus", "fmt-ogg-opus.ogg", {
  tools: ["ffmpeg", "ffmpeg:libopus"],
  build: (c) => c.ffmpeg([...sine(440), "-t", "8", "-c:a", "libopus", "-b:a", "64k", c.out]),
});
audio("aud-fmt-webm-opus", "fmt-webm-opus.webm", {
  tools: ["ffmpeg", "ffmpeg:libopus"],
  // What Chrome's MediaRecorder produces.
  build: (c) => c.ffmpeg([...sine(440), "-t", "8", "-c:a", "libopus", "-b:a", "64k", c.out]),
});
audio("aud-dur-1s5", "dur-1s5.m4a", {
  tools: ["ffmpeg", "ffmpeg:aac"],
  // A voice note: shorter than any seek-bar tick spacing.
  build: (c) => c.ffmpeg([...sine(440), "-t", "1.5", "-c:a", "aac", "-b:a", "48k", "-ac", "1", c.out]),
});
audio("aud-dur-3min", "dur-3min.mp3", {
  tools: ["ffmpeg", "ffmpeg:libmp3lame"],
  build: (c) => c.ffmpeg([...lavfi("sine=frequency=330:sample_rate=44100:beep_factor=3:duration=180"), "-c:a", "libmp3lame", "-b:a", "64k", "-ac", "1", c.out]),
});
audio("aud-dur-1h05", "dur-1h05.mp3", {
  tools: ["ffmpeg", "ffmpeg:libmp3lame"],
  // 3900 s of 8 kb/s mono (8 kHz MPEG-2.5) is ~3.9 MB.
  build: (c) =>
    c.ffmpeg([...lavfi("sine=frequency=220:sample_rate=8000:beep_factor=3:duration=3900"), "-c:a", "libmp3lame", "-ac", "1", "-ar", "8000", "-b:a", "8k", c.out]),
  verify: (c) => {
    c.expectSize({ max: 4_000_000 });
    c.expectDuration(3900);
  },
});
audio("aud-chan-stereo-lr", "chan-stereo-lr.m4a", {
  tools: ["ffmpeg", "ffmpeg:aac"],
  // 440 Hz on the left channel only, 880 Hz on the right only.
  build: (c) =>
    c.ffmpeg([
      ...lavfi("sine=frequency=440:sample_rate=44100:duration=10"),
      ...lavfi("sine=frequency=880:sample_rate=44100:duration=10"),
      "-filter_complex", "[0:a][1:a]amerge=inputs=2[a]", "-map", "[a]",
      "-c:a", "aac", "-b:a", "96k", c.out,
    ]),
  verify: (c) => c.expectProbe((s) => (Number(s.channels) === 2 ? null : `${s.channels} channels`)),
});
audio("aud-chan-silent", "chan-silent.mp3", {
  tools: ["ffmpeg", "ffmpeg:libmp3lame"],
  build: (c) => c.ffmpeg([...lavfi("anullsrc=r=44100:cl=stereo"), "-t", "5", "-c:a", "libmp3lame", "-b:a", "64k", c.out]),
});
audio("aud-meta-id3-cover", "meta-id3-cover.mp3", {
  tools: ["ffmpeg", "ffmpeg:libmp3lame"],
  build: (c) => {
    const cover = c.tmp("cover.jpg");
    c.ffmpeg([...testsrc2(500, 500), ...stillFrame, "-q:v", "4", cover]);
    c.ffmpeg([
      ...lavfi("sine=frequency=392:sample_rate=44100:beep_factor=3:duration=8"), "-i", cover,
      "-map", "0:a", "-map", "1:v", "-c:a", "libmp3lame", "-b:a", "96k", "-c:v", "copy",
      "-id3v2_version", "3",
      "-metadata", "title=Media Lab Test Tone", "-metadata", "artist=Template Fixtures", "-metadata", "album=Media Lab",
      "-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)",
      c.out,
    ]);
  },
  verify: (c) => {
    const probe = c.probe();
    const tags = probe.format?.tags ?? {};
    const hasCover = (probe.streams ?? []).some((s) => s.codec_type === "video");
    if (!hasCover) throw new Error("no embedded cover art stream");
    if (!tags.title || !tags.artist) throw new Error(`missing ID3 title/artist: ${JSON.stringify(tags)}`);
  },
});
audio("aud-broken-truncated", "broken-truncated.mp3", {
  tools: ["ffmpeg", "ffmpeg:libmp3lame"],
  // An MP3 is a frame stream, so half the bytes still decodes (about 3 s) while the
  // header still claims 6 s: players should report a short file or an error, not crash.
  build: (c) => {
    c.ffmpeg([...sine(440), "-t", "6", "-c:a", "libmp3lame", "-b:a", "128k", c.tmp("src.mp3")]);
    const bytes = readFileSync(c.tmp("src.mp3"));
    // Cut mid-frame so the tail is a partial frame.
    writeFileSync(c.out, bytes.subarray(0, Math.floor(bytes.length / 2) + 7));
  },
});
audio("aud-broken-zero", "broken-zero.mp3", { build: (c) => writeFileSync(c.out, "") });
audio("aud-broken-text", "broken-text.mp3", {
  build: (c) => writeFileSync(c.out, "This is not audio.\nIt is plain text saved with an .mp3 extension.\n"),
});

// ---------------------------------------------------------------------------
// Byte-level helpers
// ---------------------------------------------------------------------------

/** A hand-written SVG; `viewBoxOnly` leaves out width/height so it has no intrinsic size. */
function svgDoc({ viewBoxOnly }) {
  const size = viewBoxOnly ? "" : " width=\"320\" height=\"200\"";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"${size}>
  <rect width="320" height="200" fill="#1d4ed8"/>
  <circle cx="90" cy="100" r="60" fill="#fbbf24"/>
  <rect x="170" y="50" width="110" height="100" rx="12" fill="#f8fafc"/>
  <path d="M185 135 L225 75 L265 135 Z" fill="#16a34a"/>
</svg>
`;
}

/**
 * Insert a minimal APP1 Exif segment (one IFD0 entry: Orientation) right after
 * SOI. Big-endian TIFF, so the segment is 34 bytes long after the marker.
 */
function withExifOrientation(jpeg, orientation) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("not a JPEG");
  const tiff = Buffer.alloc(26);
  tiff.write("MM", 0, "latin1");
  tiff.writeUInt16BE(0x002a, 2);
  tiff.writeUInt32BE(8, 4); // IFD0 offset
  tiff.writeUInt16BE(1, 8); // one entry
  tiff.writeUInt16BE(0x0112, 10); // Orientation
  tiff.writeUInt16BE(3, 12); // SHORT
  tiff.writeUInt32BE(1, 14); // count
  tiff.writeUInt16BE(orientation, 18); // value, left-justified
  tiff.writeUInt32BE(0, 22); // no next IFD
  const body = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), header, body, jpeg.subarray(2)]);
}

/** True when the JPEG has a progressive (SOF2) frame header. */
function isProgressiveJpeg(bytes) {
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) return false;
    const marker = bytes[i + 1];
    if (marker === 0xc2) return true;
    if (marker === 0xc0 || marker === 0xc1) return false;
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  return false;
}

/** Top-level MP4 box types in file order, e.g. ["ftyp", "moov", "mdat"]. */
function topLevelBoxes(file) {
  const fd = openSync(file, "r");
  try {
    const total = fstatSync(fd).size;
    const boxes = [];
    const head = Buffer.alloc(16);
    let offset = 0;
    while (offset + 8 <= total) {
      readSync(fd, head, 0, 16, offset);
      let size = head.readUInt32BE(0);
      const type = head.toString("latin1", 4, 8);
      if (size === 1) size = Number(head.readBigUInt64BE(8));
      else if (size === 0) size = total - offset;
      boxes.push(type);
      if (size < 8) break;
      offset += size;
    }
    return boxes;
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Tools and execution
// ---------------------------------------------------------------------------

function findExecutable(name) {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

const executableCache = new Map();
const hasExecutable = (name) => {
  if (!executableCache.has(name)) executableCache.set(name, findExecutable(name));
  return executableCache.get(name) !== null;
};

let encoderOutput;
const hasEncoder = (encoder) => {
  if (encoderOutput === undefined) {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" });
    encoderOutput = result.status === 0 ? result.stdout : "";
  }
  return new RegExp(`^\\s[A-Z.]{6}\\s${encoder}\\s`, "m").test(encoderOutput);
};

/** `null` when `tool` is available, otherwise the reason it is not. */
function missingReason(tool) {
  if (tool.startsWith("file:")) {
    const path = tool.slice(5);
    return existsSync(path) ? null : `missing file ${path}`;
  }
  if (tool.startsWith("ffmpeg:")) {
    if (!hasExecutable("ffmpeg")) return "ffmpeg not found";
    const encoder = tool.slice(7);
    return hasEncoder(encoder) ? null : `ffmpeg lacks the ${encoder} encoder`;
  }
  return hasExecutable(tool) ? null : `${tool} not found`;
}

const firstMissing = (fixture) => {
  for (const tool of fixture.tools) {
    const reason = missingReason(tool);
    if (reason) return reason;
  }
  return null;
};

const FFMPEG_BASE = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"];

function run(tool, args) {
  const result = spawnSync(tool, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw new Error(`${tool}: ${result.error.message}`);
  if (result.status !== 0) {
    const tail = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim().split("\n").slice(-6).join("\n");
    throw new Error(`${tool} exited ${result.status}\n${tail}`);
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function probeFile(file) {
  const out = run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file]);
  return JSON.parse(out.slice(out.indexOf("{")));
}

function makeContext(fixture, tmpDir, out) {
  const ctx = {
    out,
    tmp: (name) => join(tmpDir, name),
    run,
    ffmpeg: (args) => run("ffmpeg", [...FFMPEG_BASE, ...args]),
    has: hasExecutable,
    probe: () => probeFile(out),
    expectProbe(check) {
      if (!hasExecutable("ffprobe")) return;
      const probe = probeFile(out);
      const stream = (probe.streams ?? [])[0] ?? {};
      const problem = check(stream, probe);
      if (problem) throw new Error(problem);
    },
    expectStreams({ video: wantVideo, audio: wantAudio }) {
      if (!hasExecutable("ffprobe")) return;
      const streams = probeFile(out).streams ?? [];
      const count = (type) => streams.filter((s) => s.codec_type === type).length;
      if (count("video") !== wantVideo || count("audio") !== wantAudio) {
        throw new Error(`expected ${wantVideo} video / ${wantAudio} audio streams, found ${count("video")} / ${count("audio")}`);
      }
    },
    expectDuration(seconds) {
      if (!hasExecutable("ffprobe")) return;
      const duration = Number(probeFile(out).format?.duration);
      if (Math.abs(duration - seconds) > 2) throw new Error(`duration ${duration}s, expected ~${seconds}s`);
    },
    expectSize({ max }) {
      const size = statSync(out).size;
      if (size > max) throw new Error(`${formatBytes(size)} exceeds the ${formatBytes(max)} budget`);
    },
    expectMoovFirst() {
      const boxes = topLevelBoxes(out);
      if (boxes.indexOf("moov") > boxes.indexOf("mdat")) throw new Error(`moov is after mdat (${boxes.join(",")}): not faststart`);
    },
    expectMoovLast() {
      const boxes = topLevelBoxes(out);
      if (boxes.indexOf("moov") < boxes.indexOf("mdat")) throw new Error(`moov is before mdat (${boxes.join(",")}): this is faststart`);
    },
  };
  return ctx;
}

function sipsExpect(ctx, pattern, message) {
  const out = ctx.run("sips", ["-g", "space", "-g", "profile", ctx.out]);
  if (!pattern.test(out)) throw new Error(`${message}\n${out.trim()}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** Decimal units, matching the "2.5 MB" and "3 MB" budgets the corpus is held to. */
const formatBytes = (bytes) => {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
};

function parseArgs(argv) {
  const options = { core: false, list: false, json: false, only: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--core") options.core = true;
    else if (arg === "--list") options.list = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "--only") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("--only needs a comma-separated list of ids");
      options.only = value.split(",").map((id) => id.trim()).filter(Boolean);
      i += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.core && options.only) throw new Error("--core and --only cannot be combined");
  return options;
}

const USAGE = `Usage:
  bun run media:fixtures [--core | --only <id,…>] [--list [--json]]

  (no flag)        build the generated tier into ${GENERATED_DIR}/ (gitignored)
  --core           rebuild only the committed core in ${CORE_DIR}/
  --only a,b,pfx*  build the named fixtures from either tier; a trailing * matches a prefix
  --list           print every fixture with its tools and status, build nothing
  --json           with --list, print machine-readable JSON

Required: ffmpeg (and ffprobe for verification). Optional: avifenc, cwebp, img2webp, cjpeg, sips (macOS).`;

function selectFixtures(options) {
  if (options.only) {
    const unknown = [];
    const selected = new Set();
    for (const pattern of options.only) {
      const matches = pattern.endsWith("*")
        ? FIXTURES.filter((f) => f.id.startsWith(pattern.slice(0, -1)))
        : FIXTURES.filter((f) => f.id === pattern);
      if (matches.length === 0) unknown.push(pattern);
      for (const match of matches) selected.add(match);
    }
    if (unknown.length > 0) throw new Error(`Unknown fixture id(s): ${unknown.join(", ")}. Run with --list to see them.`);
    return FIXTURES.filter((f) => selected.has(f));
  }
  return FIXTURES.filter((f) => f.tier === (options.core ? "core" : "generated"));
}

function statusOf(fixture) {
  const absolute = join(ROOT, fixture.out);
  if (existsSync(absolute)) return { status: "built", size: statSync(absolute).size };
  const missing = firstMissing(fixture);
  return missing ? { status: "no-tool", reason: missing } : { status: "missing" };
}

function listFixtures(options) {
  const rows = FIXTURES.map((fixture) => ({
    id: fixture.id,
    kind: fixture.kind,
    tier: fixture.tier,
    out: fixture.out,
    tools: fixture.tools,
    ...statusOf(fixture),
  }));
  if (options.json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  const width = Math.max(...rows.map((r) => r.id.length));
  for (const row of rows) {
    const detail = row.status === "built" ? formatBytes(row.size) : row.status === "no-tool" ? `no tool: ${row.reason}` : "not built";
    console.log(`${row.id.padEnd(width)}  ${row.tier.padEnd(9)}  ${(row.tools.join(",") || "-").padEnd(40)}  ${detail}  ${row.out}`);
  }
}

function buildOne(fixture, tmpDir) {
  const missing = firstMissing(fixture);
  if (missing) return { id: fixture.id, status: "skipped", reason: missing };

  const finalPath = join(ROOT, fixture.out);
  mkdirSync(dirname(finalPath), { recursive: true });
  const ext = extname(finalPath);
  // Keep the real extension last so ffmpeg and sips pick the right muxer.
  const partial = join(dirname(finalPath), `.${basename(finalPath, ext)}.partial${ext}`);
  const scratch = mkdtempSync(join(tmpDir, `${fixture.id}-`));
  const ctx = makeContext(fixture, scratch, partial);

  try {
    rmSync(partial, { force: true });
    fixture.build(ctx);
    if (!existsSync(partial)) throw new Error("build produced no output");
    fixture.verify?.(ctx);
    renameSync(partial, finalPath);
    return { id: fixture.id, status: "built", size: statSync(finalPath).size };
  } catch (error) {
    rmSync(partial, { force: true });
    if (error instanceof Skip) return { id: fixture.id, status: "skipped", reason: error.message.split("\n")[0] };
    return { id: fixture.id, status: "failed", reason: error.message.split("\n").slice(0, 3).join(" | ") };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function printSummary(results, selected) {
  const rows = results.map((r) => ({
    id: r.id,
    status: r.status,
    size: r.size === undefined ? "-" : formatBytes(r.size),
    detail: r.reason ?? "",
  }));
  const widths = {
    id: Math.max(2, ...rows.map((r) => r.id.length)),
    status: Math.max(6, ...rows.map((r) => r.status.length)),
    size: Math.max(4, ...rows.map((r) => r.size.length)),
  };
  const line = (r) => `${r.id.padEnd(widths.id)}  ${r.status.padEnd(widths.status)}  ${r.size.padStart(widths.size)}  ${r.detail}`.trimEnd();
  console.log("");
  console.log(line({ id: "id", status: "status", size: "size", detail: "detail" }));
  console.log(line({ id: "-".repeat(widths.id), status: "-".repeat(widths.status), size: "-".repeat(widths.size), detail: "-".repeat(6) }));
  for (const row of rows) console.log(line(row));

  const built = results.filter((r) => r.status === "built");
  const skipped = results.filter((r) => r.status === "skipped");
  const failed = results.filter((r) => r.status === "failed");
  const total = built.reduce((sum, r) => sum + r.size, 0);
  console.log("");
  console.log(`Built ${built.length} of ${selected.length} (${formatBytes(total)} total), skipped ${skipped.length}, failed ${failed.length}.`);
  return { built, skipped, failed, total };
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }
  if (options.list) {
    listFixtures(options);
    return;
  }

  let selected;
  try {
    selected = selectFixtures(options);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  if (!hasExecutable("ffmpeg")) {
    console.warn("warning: ffmpeg not found. Install it (brew install ffmpeg) to build most fixtures.");
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "media-fixtures-"));
  const results = [];
  try {
    for (const fixture of selected) {
      process.stdout.write(`building ${fixture.id} …`);
      const result = buildOne(fixture, tmpDir);
      results.push(result);
      if (result.status === "built") console.log(` ${formatBytes(result.size)}`);
      else {
        console.log("");
        console.warn(`  ${result.status}: ${fixture.id}: ${result.reason}`);
      }
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  const { failed } = printSummary(results, selected);

  let overBudget = false;
  if (options.core) {
    const onDisk = FIXTURES.filter((f) => f.tier === "core").reduce((sum, f) => {
      const file = join(ROOT, f.out);
      return sum + (existsSync(file) ? statSync(file).size : 0);
    }, 0);
    overBudget = onDisk > CORE_BUDGET_BYTES;
    console.log(`Core on disk: ${formatBytes(onDisk)} of ${formatBytes(CORE_BUDGET_BYTES)} budget${overBudget ? " EXCEEDED" : ""}.`);
  }
  if (results.length > 0 && results.every((r) => r.status === "skipped")) {
    console.warn("Nothing was built: every selected fixture was skipped.");
  }
  if (failed.length > 0 || overBudget) process.exit(1);
}

main();
