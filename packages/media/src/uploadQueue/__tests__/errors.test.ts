import { MediaError } from "../../errors";
import { MediaProcessingError } from "../../processing/errors";
import { describeUploadQueueError } from "../errors";

describe("describeUploadQueueError", () => {
  it("maps every MediaProcessingError code to a short message", () => {
    expect(
      describeUploadQueueError(
        new MediaProcessingError("unsupported-format", "image/heic cannot be uploaded."),
        "processing",
      ),
    ).toBe("image/heic cannot be uploaded.");
    expect(
      describeUploadQueueError(new MediaProcessingError("heic-conversion-failed", "boom"), "processing"),
    ).toBe("This photo could not be converted.");
    expect(
      describeUploadQueueError(new MediaProcessingError("decode-failed", "boom"), "processing"),
    ).toBe("This image could not be read.");
    expect(
      describeUploadQueueError(new MediaProcessingError("encode-failed", "boom"), "processing"),
    ).toBe("This image could not be optimized.");
    expect(
      describeUploadQueueError(new MediaProcessingError("stat-failed", "boom"), "processing"),
    ).toBe("This file could not be read.");
  });

  it("maps MediaError problems", () => {
    expect(describeUploadQueueError(new MediaError({ kind: "disabled" }), "uploading")).toBe(
      "Media storage is not configured.",
    );
    expect(describeUploadQueueError(new MediaError({ kind: "unauthorized" }), "uploading")).toBe(
      "Sign in to upload.",
    );
    expect(
      describeUploadQueueError(new MediaError({ kind: "forbidden", message: "Not yours" }), "uploading"),
    ).toBe("Not yours");
    expect(
      describeUploadQueueError(
        new MediaError({ kind: "bad-request", code: "oversized-file", message: "Too big: 51 MB" }),
        "uploading",
      ),
    ).toBe("This file is too large.");
    expect(
      describeUploadQueueError(
        new MediaError({ kind: "bad-request", code: "invalid-content-type", message: "x" }),
        "uploading",
      ),
    ).toBe("This file type is not accepted.");
    expect(
      describeUploadQueueError(
        new MediaError({ kind: "bad-request", message: "Bad thing" }),
        "uploading",
      ),
    ).toBe("Bad thing");
    expect(
      describeUploadQueueError(
        new MediaError({ kind: "unknown", status: 500, message: "stack trace" }),
        "uploading",
      ),
    ).toBe("Upload failed. Try again.");
  });

  it("gives other errors a generic line for their stage, never the raw message", () => {
    expect(describeUploadQueueError(new Error("TypeError: x is undefined"), "processing")).toBe(
      "This file could not be processed.",
    );
    expect(describeUploadQueueError("weird", "uploading")).toBe("Upload failed. Try again.");
    expect(describeUploadQueueError(new Error("nope"), "resolving")).toBe(
      "This file could not be prepared.",
    );
  });
});
