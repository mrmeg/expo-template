import type { ImageManipulatorContext, SaveFormat } from "expo-image-manipulator";
import type { VideoPlayer, VideoThumbnail } from "expo-video";
export interface NativeThumbnailDependencies {
    createVideoPlayer(uri: string): VideoPlayer;
    manipulate(thumbnail: VideoThumbnail): ImageManipulatorContext;
    jpegFormat: SaveFormat;
}
export declare function extractVideoThumbnailNative(uri: string, timeMs: number, dependencies: NativeThumbnailDependencies): Promise<{
    uri: string;
    width: number;
    height: number;
} | null>;
