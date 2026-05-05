const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  class MockS3Client {
    send = mockSend;
  }
  class MockCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: MockS3Client,
    DeleteObjectCommand: MockCommand,
    DeleteObjectsCommand: MockCommand,
    GetObjectCommand: MockCommand,
    ListObjectsV2Command: MockCommand,
    PutObjectCommand: MockCommand,
  };
});

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async () => "https://signed.example/url"),
}));

import { createMediaConfig } from "../../config";
import {
  createMediaHandlers,
  resetMediaStorageForTests,
} from "../handlers";

const config = createMediaConfig({
  buckets: {
    media: {
      provider: "s3",
      bucket: "test-bucket",
      region: "us-east-1",
      credentials: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
      },
    },
  },
  mediaTypes: {
    avatars: {
      bucket: "media",
      prefix: "users/avatars",
      allowedContentTypes: ["image/jpeg"],
    },
    videos: {
      bucket: "media",
      prefix: "videos",
      allowedContentTypes: ["video/mp4"],
    },
    uploads: {
      bucket: "media",
      prefix: "uploads",
      allowedContentTypes: ["image/jpeg"],
    },
  },
});

describe("createMediaHandlers list", () => {
  beforeEach(() => {
    mockSend.mockReset();
    resetMediaStorageForTests();
  });

  it("lists the configured prefix for a mediaType request", async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [
        {
          Key: "uploads/photo.jpg",
          Size: 123,
          LastModified: new Date("2026-05-04T00:00:00.000Z"),
        },
      ],
    });
    const canList = jest.fn(() => true);
    const handlers = createMediaHandlers({
      config,
      policy: { canList },
    });

    const res = await handlers.list(
      new Request("http://localhost/list?mediaType=uploads&limit=25"),
    );

    expect(res.status).toBe(200);
    expect(canList).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: "uploads", prefix: "uploads" }),
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Prefix: "uploads",
      MaxKeys: 25,
    });
    await expect(res.json()).resolves.toMatchObject({
      items: [{ key: "uploads/photo.jpg", size: 123 }],
      totalCount: 1,
    });
  });

  it("rejects unscoped list requests before reaching S3", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(new Request("http://localhost/list"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "bad-request",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects unknown prefix-only list requests before reaching S3", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(
      new Request("http://localhost/list?prefix=private"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "bad-key",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects prefixes outside the requested media type", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(
      new Request("http://localhost/list?mediaType=uploads&prefix=videos"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "bad-key",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("allows narrower prefixes inside the requested media type", async () => {
    mockSend.mockResolvedValueOnce({ Contents: [] });
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(
      new Request("http://localhost/list?mediaType=uploads&prefix=uploads/gallery"),
    );

    expect(res.status).toBe(200);
    const command = mockSend.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Prefix: "uploads/gallery",
    });
  });
});
