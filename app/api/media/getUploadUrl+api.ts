import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ulid } from "ulid";
import { MEDIA_PATHS, type MediaType } from "@/shared/media";
import { getCorsHeaders, getPreflightHeaders, sanitizeErrorDetails } from "@/app/api/_shared/cors";

interface UploadUrlRequest {
  /** File extension (e.g., "png", "jpg") */
  extension: string;
  /** Media type key from MEDIA_PATHS */
  mediaType: MediaType;
  /** Optional custom filename (without extension) - if not provided, a ULID is generated */
  customFilename?: string;
}

interface UploadUrlResponse {
  /** Presigned URL to upload to */
  uploadUrl: string;
  /** The key where the file will be stored */
  key: string;
  /** When the upload URL expires */
  expiresAt: string;
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_JURISDICTION_SPECIFIC_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: getPreflightHeaders(request),
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: UploadUrlRequest = await request.json();
    const { extension, mediaType, customFilename } = body;

    if (!extension || typeof extension !== "string") {
      return new Response(JSON.stringify({ message: "Missing or invalid extension" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }

    if (!mediaType || !(mediaType in MEDIA_PATHS)) {
      return new Response(
        JSON.stringify({
          message: "Missing or invalid mediaType",
          validTypes: Object.keys(MEDIA_PATHS),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
        }
      );
    }

    const path = MEDIA_PATHS[mediaType];
    const ext = extension.replace(/^\./, "");
    const filename = customFilename ? `${customFilename}.${ext}` : `${ulid()}.${ext}`;
    const key = `${path}/${filename}`;
    const expiresIn = 300; // 5 minutes

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const response: UploadUrlResponse = {
      uploadUrl,
      key,
      expiresAt,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return new Response(
      JSON.stringify({
        message: "Internal server error",
        ...sanitizeErrorDetails(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }
}
