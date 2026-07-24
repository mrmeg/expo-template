export async function extractVideoThumbnailNative(uri, timeMs, dependencies) {
    const player = dependencies.createVideoPlayer(uri);
    try {
        const thumbnails = await player.generateThumbnailsAsync(timeMs / 1000);
        const thumbnail = thumbnails[0];
        if (!thumbnail)
            return null;
        try {
            const context = dependencies.manipulate(thumbnail);
            try {
                const image = await context.renderAsync();
                try {
                    const result = await image.saveAsync({
                        compress: 0.8,
                        format: dependencies.jpegFormat,
                    });
                    return {
                        uri: result.uri,
                        width: result.width,
                        height: result.height,
                    };
                }
                finally {
                    image.release();
                }
            }
            finally {
                context.release();
            }
        }
        finally {
            thumbnail.release();
        }
    }
    finally {
        player.release();
    }
}
