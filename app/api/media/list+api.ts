import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getCorsHeaders, getPreflightHeaders, sanitizeErrorDetails } from "@/app/api/_shared/cors";

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

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const prefix = url.searchParams.get("prefix") || "";
    const cursor = url.searchParams.get("cursor") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);

    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET,
      Prefix: prefix || undefined,
      MaxKeys: limit,
      ContinuationToken: cursor,
    });

    const result = await s3Client.send(command);

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
