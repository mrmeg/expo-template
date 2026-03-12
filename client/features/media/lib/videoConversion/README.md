# Video Conversion (FFmpeg.wasm)

Web-only feature that converts non-MP4 videos (WebM, AVI, MKV, etc.) to MP4 (H.264/AAC) for cross-platform playback compatibility.

## How It Works

- Uses FFmpeg.wasm (~30MB, loaded lazily on first use)
- Converts videos client-side in the browser
- Native platforms (iOS/Android) don't need this - they handle video formats natively

## Files in This Folder

| File | Purpose |
|------|---------|
| `config.ts` | CDN URLs, presets, size limits |
| `convert.ts` | Web implementation using FFmpeg.wasm |
| `convert.native.ts` | Native stub (no-op, returns original video) |
| `ffmpeg-worker.js` | Bundled FFmpeg worker (served by Metro/Express) |
| `index.ts` | Barrel export |
| `types.ts` | TypeScript types |
| `utils.ts` | Format detection utilities |

## Usage

```tsx
import { needsConversion } from "@/client/lib/videoConversion/utils";
import { convertVideo } from "@/client/lib/videoConversion/convert";

if (needsConversion(mimeType)) {
  const result = await convertVideo(videoUri, mimeType, {
    preset: "fast", // "fast" | "balanced" | "quality"
    onProgress: (percent) => console.log(`${percent}%`),
  });
}
```

## Removal Instructions

If you don't need web video conversion, remove this feature entirely:

1. **Delete this folder**: `rm -rf client/lib/videoConversion/`
2. **metro.config.js**: Delete from `// FFmpeg Video Conversion` to `// END FFmpeg`
3. **server/index.ts**: Delete from `// FFmpeg Video Conversion` to `// END FFmpeg`
4. **useMediaLibrary.ts**: Remove videoConversion imports and the conversion logic block
