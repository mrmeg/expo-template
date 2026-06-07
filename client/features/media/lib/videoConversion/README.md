# App Video Conversion Bridge

App-local bridge for the web video conversion helpers that now live in
`@mrmeg/expo-media/processing/video-conversion`. It converts non-MP4 videos
(WebM, AVI, MKV, etc.) to MP4 (H.264/AAC) for cross-platform playback
compatibility.

## How It Works

- Uses FFmpeg.wasm (~30MB, loaded lazily on first use)
- Converts videos client-side in the browser
- Native platforms (iOS/Android) return the original video
- The production worker is served from `packages/media/src/processing/videoConversion/ffmpeg-worker.js`

## Files in This Folder

| File | Purpose |
|------|---------|
| `config.ts` | App-local CDN URLs, presets, size limits |
| `convert.ts` | App-local web implementation using FFmpeg.wasm |
| `convert.native.ts` | Native stub, returns original video |
| `ffmpeg-worker.js` | Legacy app-local worker copy |
| `index.ts` | Barrel export for the app-local bridge |
| `types.ts` | TypeScript types |
| `utils.ts` | Format detection utilities |

## Usage

```tsx
import { convertVideo, needsConversion } from "@/client/features/media/lib/videoConversion";

if (needsConversion(mimeType)) {
  const result = await convertVideo(videoUri, mimeType, {
    preset: "fast", // "fast" | "balanced" | "quality"
    onProgress: (percent) => console.log(`${percent}%`),
  });
}
```

## Removal Instructions

If you don't need web video conversion, remove this feature entirely:

1. Delete this folder: `client/features/media/lib/videoConversion/`
2. Remove video conversion imports and conversion logic from
   `client/features/media/hooks/useMediaLibrary.ts`
3. If no other code imports `FFMPEG_WORKER_URL`, remove the FFmpeg worker
   serving hooks from `metro.config.js`, `server/index.ts`, and `server.bun.ts`
