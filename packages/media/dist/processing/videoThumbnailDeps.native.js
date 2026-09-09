/**
 * Native loader for the expo modules behind `extractVideoThumbnailNative`.
 *
 * A platform file rather than a `Platform.OS` branch: Metro registers every
 * `import()` it can see as an async chunk regardless of the branch it sits in,
 * and on web the media tab imports `expo-video` statically for playback. Two
 * chunks reaching `expo-video` hoists it into the eagerly loaded `__common`
 * bundle for every route. The web sibling (`videoThumbnailDeps.ts`) has no
 * import at all, so the web graph reaches `expo-video` from exactly one place.
 */
export async function loadNativeThumbnailDependencies() {
    const [{ createVideoPlayer }, { ImageManipulator, SaveFormat }] = await Promise.all([
        import("expo-video"),
        import("expo-image-manipulator"),
    ]);
    return {
        createVideoPlayer,
        manipulate: (thumbnail) => ImageManipulator.manipulate(thumbnail),
        jpegFormat: SaveFormat.JPEG,
    };
}
