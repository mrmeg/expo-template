import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";

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
  "Access-Control-Allow-Methods": "DELETE, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" },
  });
}

// DELETE single file
export async function DELETE(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return new Response(JSON.stringify({ message: "Missing key parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
      })
    );

    return new Response(JSON.stringify({ success: true, key }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to delete file",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
}

// POST to delete multiple files
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { keys } = body;

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return new Response(JSON.stringify({ message: "Missing or invalid keys array" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (keys.length > 1000) {
      return new Response(JSON.stringify({ message: "Maximum 1000 keys per request" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const result = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: process.env.R2_BUCKET,
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
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  } catch (error) {
    console.error("Error deleting files:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to delete files",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
}
