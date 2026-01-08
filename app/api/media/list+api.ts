import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" },
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
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (error) {
    console.error("Error listing media:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to list media",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
}
