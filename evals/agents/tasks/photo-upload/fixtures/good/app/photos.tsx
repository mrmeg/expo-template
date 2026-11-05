import { View } from "react-native";
import { Button, Screen } from "@mrmeg/expo-ui/components";
import { MediaGrid } from "@mrmeg/expo-ui/components/MediaGrid";
import { MediaTile } from "@mrmeg/expo-ui/components/MediaTile";
import { UploadQueue } from "@mrmeg/expo-ui/components/UploadQueue";
import { spacing } from "@mrmeg/expo-ui/constants";
import { createMediaClient } from "@mrmeg/expo-media/client";
import { useMediaPicker } from "@mrmeg/expo-media/picker";
import { createMediaQueryHooks } from "@mrmeg/expo-media/react-query";
import { useUploadQueue } from "@mrmeg/expo-media/upload-queue";

const client = createMediaClient({ basePath: "https://api.example.test/api/media" });
const { useMediaUpload } = createMediaQueryHooks({ client });

// The content types the server accepts: the same list on both sides.
const ALLOWLIST = { image: ["image/jpeg", "image/png"], video: [] } as const;

export default function PhotosScreen() {
  const picker = useMediaPicker();
  const upload = useMediaUpload();
  const queue = useUploadQueue({
    upload: upload.mutateAsync,
    allowlist: ALLOWLIST,
    resolve: () => ({ mediaType: "photos" }),
  });

  async function pickPhotos() {
    const result = await picker.pick({ multiple: true });
    if (result.status === "picked") queue.add(result.assets);
  }

  return (
    <Screen edges={["bottom"]} padded={false}>
      <MediaGrid
        data={queue.items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
            <Button fullWidth loading={picker.picking} text="Choose photos" onPress={pickPhotos} />
            <UploadQueue
              title="Uploads"
              entries={queue.items}
              onRetry={queue.retry}
              onRemove={queue.remove}
              onClearFinished={queue.clearFinished}
            />
          </View>
        }
        renderTile={({ item, size }) => (
          <MediaTile
            id={item.id}
            kind="image"
            source={item.previewUri ? { uri: item.previewUri } : undefined}
            size={size}
            title={item.fileName}
          />
        )}
      />
    </Screen>
  );
}
