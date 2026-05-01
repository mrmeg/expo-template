import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCorsHeaders, getPreflightHeaders, sanitizeErrorDetails } from "@/server/api/shared/cors";
import {
  getMediaS3Client,
  getMediaStorageEnv,
  mediaDisabledResponse,
  type MediaStorageEnv,
} from "@/server/api/media/storage";

interface GetMediaResponse {
  urls: {
    [key: string]: string;
  };
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: getPreflightHeaders(request),
  });
}

export async function POST(request: Request): Promise<Response> {
  const env = getMediaStorageEnv();
  if (env.kind === "unconfigured") {
    return mediaDisabledResponse(request, env.missing);
  }

  try {
    const body = await request.json();
    const { keys, path } = body;

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return new Response(JSON.stringify({ message: "Missing or invalid keys" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }

    const urls: GetMediaResponse["urls"] = {};

    // Generate signed URLs for each key
    // If path is provided, prepend it to each key; otherwise use keys as full paths
    for (const key of keys) {
      if (!key) continue;

      const fullKey = path ? `${path}/${key}` : key;
      const mediaUrl = await generatePresignedUrl(env, fullKey);
      urls[key] = mediaUrl;
    }

    return new Response(JSON.stringify({ urls }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (error) {
    console.error("Error generating media URLs:", error);
    return new Response(JSON.stringify({
      message: "Internal server error",
      ...sanitizeErrorDetails(error),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
}

async function generatePresignedUrl(
  env: Extract<MediaStorageEnv, { kind: "configured" }>,
  key: string,
  expiresIn = 86400,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.bucket,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(getMediaS3Client(env), command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error(`Error generating presigned URL for ${key}:`, error);
    throw error;
  }
}
