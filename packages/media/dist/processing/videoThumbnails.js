import { Platform } from "react-native";
export async function extractVideoThumbnail(videoUri, timeMs = 1000) {
    if (Platform.OS === "web") {
        return extractThumbnailWeb(videoUri, timeMs);
    }
    return extractThumbnailNative(videoUri, timeMs);
}
async function extractThumbnailNative(uri, timeMs) {
    try {
        const VideoThumbnails = await import("expo-video-thumbnails");
        const result = await VideoThumbnails.getThumbnailAsync(uri, {
            time: timeMs,
            quality: 0.8,
        });
        return {
            uri: result.uri,
            width: result.width,
            height: result.height,
        };
    }
    catch {
        return null;
    }
}
function extractThumbnailWeb(uri, timeMs) {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        const cleanup = () => {
            video.removeEventListener("loadeddata", handleLoaded);
            video.removeEventListener("error", handleError);
            video.src = "";
            video.load();
        };
        const handleLoaded = () => {
            video.currentTime = timeMs / 1000;
        };
        const handleSeeked = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    cleanup();
                    resolve(null);
                    return;
                }
                ctx.drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                    cleanup();
                    if (!blob) {
                        resolve(null);
                        return;
                    }
                    resolve({
                        uri: URL.createObjectURL(blob),
                        width: canvas.width,
                        height: canvas.height,
                        blob,
                    });
                }, "image/jpeg", 0.8);
            }
            catch {
                cleanup();
                resolve(null);
            }
        };
        const handleError = () => {
            cleanup();
            resolve(null);
        };
        video.addEventListener("loadeddata", handleLoaded);
        video.addEventListener("seeked", handleSeeked, { once: true });
        video.addEventListener("error", handleError);
        video.src = uri;
        video.load();
        setTimeout(() => {
            cleanup();
            resolve(null);
        }, 10000);
    });
}
