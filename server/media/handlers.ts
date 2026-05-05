import { createMediaHandlers, resetMediaStorageForTests } from "@mrmeg/expo-media/server";
import {
  requireAuthenticatedUser,
  type AuthenticatedUser,
} from "@/server/api/shared/auth";
import { ensureAuthBootstrapped } from "@/server/api/shared/authBootstrap";
import { getCorsHeaders, getPreflightHeaders } from "@/server/api/shared/cors";
import { getTemplateMediaConfig } from "./config";

interface PublicMediaAccess {
  userId: "public-media-demo";
  email: null;
  publicMediaAccess: true;
}

type TemplateMediaAuth = AuthenticatedUser | PublicMediaAccess;

const PUBLIC_MEDIA_ACCESS_FLAG = "EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA";

export const mediaHandlers = createMediaHandlers<TemplateMediaAuth>({
  config: getTemplateMediaConfig,
  authorize: authorizeMediaRequest,
  cors: {
    getHeaders: getCorsHeaders,
    getPreflightHeaders,
  },
  policy: {
    canUpload: async ({ auth, mediaType, customFilename }) => ({
      allowed: Boolean(auth),
      allowCustomFilename: Boolean(customFilename && mediaType === "thumbnails"),
    }),
    canRead: async ({ auth }) => ({ allowed: Boolean(auth) }),
    canList: async ({ auth }) => ({ allowed: Boolean(auth) }),
    canDelete: async ({ auth }) => ({ allowed: Boolean(auth) }),
  },
});

async function authorizeMediaRequest(
  request: Request,
): Promise<TemplateMediaAuth | null> {
  if (isPublicMediaAccessAllowed()) {
    return {
      userId: "public-media-demo",
      email: null,
      publicMediaAccess: true,
    };
  }

  ensureAuthBootstrapped();
  const auth = await requireAuthenticatedUser(request);
  return auth.ok ? auth.user : null;
}

function isPublicMediaAccessAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env[PUBLIC_MEDIA_ACCESS_FLAG] === "true"
  );
}

export { resetMediaStorageForTests };
