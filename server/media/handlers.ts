import { createMediaHandlers, resetMediaStorageForTests } from "@mrmeg/expo-media/server";
import { getCorsHeaders, getPreflightHeaders } from "@/server/api/shared/cors";
import { getTemplateMediaConfig } from "./config";

export const mediaHandlers = createMediaHandlers({
  config: getTemplateMediaConfig,
  cors: {
    getHeaders: getCorsHeaders,
    getPreflightHeaders,
  },
  policy: {
    canUpload: async ({ mediaType, customFilename }) => ({
      allowed: true,
      allowCustomFilename: Boolean(customFilename && mediaType === "thumbnails"),
    }),
  },
});

export { resetMediaStorageForTests };
