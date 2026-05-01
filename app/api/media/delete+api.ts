import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getCorsHeaders, getPreflightHeaders, sanitizeErrorDetails } from "@/server/api/shared/cors";
import {
  getMediaS3Client,
  getMediaStorageEnv,
  mediaDisabledResponse,
} from "@/server/api/media/storage";

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: getPreflightHeaders(request),
  });
}

// DELETE single file
export async function DELETE(request: Request): Promise<Response> {
  const env = getMediaStorageEnv();
  if (env.kind === "unconfigured") {
    return mediaDisabledResponse(request, env.missing);
  }

  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return new Response(JSON.stringify({ message: "Missing key parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }

    await getMediaS3Client(env).send(
      new DeleteObjectCommand({
        Bucket: env.bucket,
        Key: key,
      })
    );

    return new Response(JSON.stringify({ success: true, key }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to delete file",
        ...sanitizeErrorDetails(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }
}

// POST to delete multiple files
export async function POST(request: Request): Promise<Response> {
  const env = getMediaStorageEnv();
  if (env.kind === "unconfigured") {
    return mediaDisabledResponse(request, env.missing);
  }

  try {
    const body = await request.json();
    const { keys } = body;

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return new Response(JSON.stringify({ message: "Missing or invalid keys array" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }

    if (keys.length > 1000) {
      return new Response(JSON.stringify({ message: "Maximum 1000 keys per request" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }

    const result = await getMediaS3Client(env).send(
      new DeleteObjectsCommand({
        Bucket: env.bucket,
        Delete: {
          Objects: keys.map((key: string) => ({ Key: key })),
          Quiet: false,
        },
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        deleted: result.Deleted?.map((d) => d.Key) || [],
        errors: result.Errors?.map((e) => ({ key: e.Key, message: e.Message })) || [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  } catch (error) {
    console.error("Error deleting files:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to delete files",
        ...sanitizeErrorDetails(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }
}
