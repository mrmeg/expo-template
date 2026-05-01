import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getCorsHeaders, getPreflightHeaders, sanitizeErrorDetails } from "@/server/api/shared/cors";
import {
  getMediaS3Client,
  getMediaStorageEnv,
  mediaDisabledResponse,
} from "@/server/api/media/storage";

interface MediaItem {
  key: string;
  size: number;
  lastModified: string;
}

interface ListResponse {
  items: MediaItem[];
  totalCount: number;
  nextCursor?: string;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: getPreflightHeaders(request),
  });
}

export async function GET(request: Request): Promise<Response> {
  const env = getMediaStorageEnv();
  if (env.kind === "unconfigured") {
    return mediaDisabledResponse(request, env.missing);
  }

  try {
    const url = new URL(request.url);
    const prefix = url.searchParams.get("prefix") || "";
    const cursor = url.searchParams.get("cursor") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);

    const command = new ListObjectsV2Command({
      Bucket: env.bucket,
      Prefix: prefix || undefined,
      MaxKeys: limit,
      ContinuationToken: cursor,
    });

    const result = await getMediaS3Client(env).send(command);

    const items: MediaItem[] = (result.Contents || []).map((item) => ({
      key: item.Key!,
      size: item.Size || 0,
      lastModified: item.LastModified?.toISOString() || "",
    }));

    const response: ListResponse = {
      items,
      totalCount: items.length,
      nextCursor: result.NextContinuationToken,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (error) {
    console.error("Error listing media:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to list media",
        ...sanitizeErrorDetails(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }
}
