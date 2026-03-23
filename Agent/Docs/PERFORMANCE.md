# Performance

> Budgets, benchmarks, and known considerations.

---

## Bundle & Loading

### Fonts
- **Lato** (400 Regular, 700 Bold) loaded via `expo-font`
- **Feather** icons loaded alongside fonts
- Splash screen held until fonts loaded (`SplashScreen.preventAutoHideAsync()`)

### i18n
- English translations always bundled
- Spanish (and future locales) lazy-loaded on first use
- Language detection happens once at startup via `expo-localization`

### Async Routes (Web)
- Web uses async route loading (`asyncRoutes: true` in app.json)
- Reduces initial bundle by code-splitting per route
- Native loads all routes synchronously (standard behavior)

### FFmpeg (Web Only)
- FFmpeg.wasm loaded only when video conversion needed
- Worker served optionally by Express server or Metro
- Can be removed entirely if video conversion isn't needed (see metro.config.js comments)

## Rendering

### Animation Performance
- All animations use `react-native-reanimated` (runs on UI thread on native)
- `useScalePress`: Spring animation with damping 20, stiffness 300
- `useStaggeredEntrance`: 200ms default, 30ms stagger delay
- **Reduced motion**: All animation hooks check `useReduceMotion()` and skip animations when enabled

### Shadow Caching
- `getShadowStyle()` returns empty object on web (boxShadow causes RN Web crashes)
- Prevents unnecessary native shadow computation on web platform

### Color Contrast Caching
- `getContrastingColor()` uses module-level LRU cache
- Max 500 entries — prevents memory leaks from dynamic color calculations
- Cache key: `${bg}-${color1}-${color2}`

### Lists
- Media tab uses `FlatList` with proper `keyExtractor`
- Pagination via cursor-based API (no offset pagination)
- React Query handles caching and deduplication of requests

## State Management

### Store Hydration
- Zustand stores auto-load persisted state on creation
- `authStore`: Singleton init pattern with 2-second throttle prevents double-initialization
- `themeStore`, `languageStore`, `onboardingStore`: Load from storage synchronously on store creation

### React Query
- Used for server state (media list, signed URLs)
- Mutations invalidate related queries on success
- No stale time configuration observed — uses React Query defaults

## Network

### Presigned URLs
- Upload URLs: 5-minute expiry (short-lived for security)
- Download URLs: 24-hour expiry (cached for performance)
- Batch URL generation supported (`getSignedUrls` accepts array)

### Rate Limiting (Production Server)
- General: 500 requests per 15 minutes
- Strict (uploads/auth): 10 requests per minute
- Applied only in production Express server, not in dev

### Compression & CORS
- Express uses `compression` middleware for all responses
- CORS whitelist: localhost:8081, localhost:3000, or `ALLOWED_ORIGINS` env var

## Image Processing

### Compression
- Runs client-side before upload
- Platform-specific implementations (native uses `expo-image-manipulator`, web uses canvas)
- Presets range from 0.6 quality (thumbnails) to 0.95 (high quality)
- HEIC auto-converts to JPEG

### Video Thumbnails
- Extracted client-side via `expo-video-thumbnails` (native) or FFmpeg.wasm (web)
- Thumbnails uploaded alongside video to `thumbnails/` path

## Known Considerations

1. **Metro deduplication** — `@react-navigation` packages need manual deduplication in metro.config.js due to bun hoisting behavior. Without this, duplicate packages increase bundle size.

2. **Web shadow workaround** — boxShadow on React Native Web causes crashes. All shadow usage must go through `getShadowStyle()` which returns `{}` on web.

3. **Style array crash** — Nested style arrays crash `@rn-primitives` on web. Always use `StyleSheet.flatten()`.

4. **Contrast cache eviction** — At 500 entries, oldest entries are evicted. In screens with many dynamic colors, this could cause recalculation. In practice, 500 is sufficient for all current screens.

5. **No offline support** — Media operations, auth, and API calls all require network. No optimistic updates or offline queue.

<!-- NEEDS HUMAN REVIEW: No bundle size budget or performance benchmarks are currently defined. Consider adding lighthouse scores, bundle size limits, or startup time targets as the app matures. -->
