import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface GetMediaResponse {
  urls: {
    [key: string]: string;
  };
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
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { keys, path } = body;

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return new Response(JSON.stringify({ message: "Missing or invalid keys" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    const urls: GetMediaResponse["urls"] = {};

    // Generate signed URLs for each key
    // If path is provided, prepend it to each key; otherwise use keys as full paths
    for (const key of keys) {
      if (!key) continue;

      const fullKey = path ? `${path}/${key}` : key;
      const mediaUrl = await generatePresignedUrl(fullKey);
      urls[key] = mediaUrl;
    }

    return new Response(JSON.stringify({ urls }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  } catch (error) {
    console.error("Error generating media URLs:", error);
    return new Response(JSON.stringify({
      message: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
}

async function generatePresignedUrl(key: string, expiresIn = 86400): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error(`Error generating presigned URL for ${key}:`, error);
    throw error;
  }
}
