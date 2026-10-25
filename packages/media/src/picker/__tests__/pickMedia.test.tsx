/**
 * `expo-image-picker` is mocked at the module boundary, so these exercise the
 * package's own decisions: when it asks for permission, what it passes to the
 * launcher, and how each outcome maps to the discriminated result.
 */

import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockPicker = {
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  getCameraPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
};

jest.mock("expo-image-picker", () => ({
  __esModule: true,
  PermissionStatus: { UNDETERMINED: "undetermined", GRANTED: "granted", DENIED: "denied" },
  getMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockPicker.getMediaLibraryPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockPicker.requestMediaLibraryPermissionsAsync(...args),
  getCameraPermissionsAsync: (...args: unknown[]) => mockPicker.getCameraPermissionsAsync(...args),
  requestCameraPermissionsAsync: (...args: unknown[]) =>
    mockPicker.requestCameraPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockPicker.launchImageLibraryAsync(...args),
  launchCameraAsync: (...args: unknown[]) => mockPicker.launchCameraAsync(...args),
}));

import { pickMedia, toPickedMediaAsset, useMediaPicker } from "..";

const granted = { status: "granted", granted: true, canAskAgain: true, expires: "never" };
const undetermined = { status: "undetermined", granted: false, canAskAgain: true, expires: "never" };
const deniedFinal = { status: "denied", granted: false, canAskAgain: false, expires: "never" };

const photo = {
  uri: "file:///photo.heic",
  width: 3024,
  height: 4032,
  type: "image" as const,
  fileName: "IMG_0001.HEIC",
  fileSize: 2_000_000,
  mimeType: "image/heic",
  exif: {
    Orientation: 6,
    DateTimeOriginal: "2024:03:09 14:05:30",
    GPSLatitude: 37.5,
    GPSLatitudeRef: "N",
    GPSLongitude: 122.25,
    GPSLongitudeRef: "W",
  },
};

const video = {
  uri: "file:///clip.mov",
  width: 1920,
  height: 1080,
  type: "video" as const,
  fileName: null,
  fileSize: 9_000_000,
  mimeType: "video/quicktime",
  duration: 12_500,
  exif: null,
};

beforeEach(() => {
  mockPicker.getMediaLibraryPermissionsAsync.mockResolvedValue(granted);
  mockPicker.getCameraPermissionsAsync.mockResolvedValue(granted);
  mockPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
  mockPicker.requestCameraPermissionsAsync.mockResolvedValue(granted);
  mockPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [photo] });
  mockPicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [photo] });
});

describe("toPickedMediaAsset", () => {
  it("maps picker fields onto ProcessAssetInput and attaches id and EXIF", async () => {
    const picked = await toPickedMediaAsset(photo as never, 0);

    expect(picked).toMatchObject({
      uri: "file:///photo.heic",
      contentType: "image/heic",
      fileName: "IMG_0001.HEIC",
      width: 3024,
      height: 4032,
      size: 2_000_000,
      kind: "image",
      exifOrientation: 6,
    });
    expect(picked.blob).toBeUndefined();
    expect(picked.id).toEqual(expect.any(String));
    expect(picked.exif).toEqual({
      takenAt: new Date(2024, 2, 9, 14, 5, 30),
      lat: 37.5,
      lng: -122.25,
    });
  });

  it("treats video, names unnamed files, and converts duration from ms to seconds", async () => {
    const picked = await toPickedMediaAsset(video as never, 2);

    expect(picked).toMatchObject({
      kind: "video",
      fileName: "file-3",
      durationSeconds: 12.5,
      exifOrientation: null,
    });
    expect(picked.exif).toBeUndefined();
  });

  it("gives every asset a distinct id", async () => {
    const [a, b] = await Promise.all([
      toPickedMediaAsset(photo as never, 0),
      toPickedMediaAsset(photo as never, 1),
    ]);

    expect(a.id).not.toBe(b.id);
  });

  describe("on web", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "web");
    });

    it("uses the File the web picker already holds", async () => {
      const file = new Blob(["abc"], { type: "image/jpeg" });
      const fetchSpy = jest.spyOn(globalThis, "fetch");

      const picked = await toPickedMediaAsset({ ...photo, file } as never, 0);

      expect(picked.blob).toBe(file);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("reads the Blob for the URI otherwise", async () => {
      const blob = new Blob(["abc"], { type: "image/jpeg" });
      const fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue({ blob: async () => blob } as Response);

      const picked = await toPickedMediaAsset({ ...photo, uri: "blob:http://x/1" } as never, 0);

      expect(fetchSpy).toHaveBeenCalledWith("blob:http://x/1");
      expect(picked.blob).toBe(blob);
    });

    it("carries on without bytes when the read fails", async () => {
      jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("revoked"));

      const picked = await toPickedMediaAsset(photo as never, 0);

      expect(picked.blob).toBeUndefined();
      expect(picked.uri).toBe(photo.uri);
    });
  });
});

describe("pickMedia", () => {
  it("resolves picked with PickedMediaAssets in picker order", async () => {
    mockPicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [video, photo],
    });

    const result = await pickMedia({ multiple: true });

    expect(result.status).toBe("picked");
    if (result.status !== "picked") return;
    expect(result.assets.map((asset) => asset.kind)).toEqual(["video", "image"]);
  });

  it("resolves canceled when the user backs out", async () => {
    mockPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    await expect(pickMedia()).resolves.toEqual({ status: "canceled" });
  });

  it("resolves canceled for an empty selection", async () => {
    mockPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [] });

    await expect(pickMedia()).resolves.toEqual({ status: "canceled" });
  });

  it("requests permission when undetermined and launches once it is granted", async () => {
    mockPicker.getMediaLibraryPermissionsAsync.mockResolvedValue(undetermined);

    const result = await pickMedia();

    expect(mockPicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockPicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("picked");
  });

  it("does not request or launch when permission was already refused for good", async () => {
    mockPicker.getMediaLibraryPermissionsAsync.mockResolvedValue(deniedFinal);

    const result = await pickMedia();

    expect(result).toEqual({ status: "denied", canAskAgain: false });
    expect(mockPicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(mockPicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("stops on a denial that happens during this pick, without launching", async () => {
    mockPicker.getMediaLibraryPermissionsAsync.mockResolvedValue(undetermined);
    mockPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      ...deniedFinal,
      canAskAgain: true,
    });

    const result = await pickMedia();

    expect(result).toEqual({ status: "denied", canAskAgain: true });
    expect(mockPicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("launches the library with full quality, EXIF, and ordered selection", async () => {
    await pickMedia({ mediaTypes: ["images", "videos"], multiple: true, selectionLimit: 5 });

    expect(mockPicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 1,
        exif: true,
        base64: false,
        orderedSelection: true,
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        allowsEditing: false,
      }),
    );
  });

  it("defaults to a single image and clamps the selection to one", async () => {
    await pickMedia({ selectionLimit: 9, allowsEditing: true });

    expect(mockPicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        selectionLimit: 1,
        allowsEditing: true,
      }),
    );
  });

  it("uses the camera launcher and the camera permission for source camera", async () => {
    mockPicker.getCameraPermissionsAsync.mockResolvedValue(undetermined);

    const result = await pickMedia({ source: "camera", multiple: true });

    expect(result.status).toBe("picked");
    expect(mockPicker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockPicker.getMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(mockPicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    const [cameraOptions] = mockPicker.launchCameraAsync.mock.calls[0];
    expect(cameraOptions).toMatchObject({ quality: 1, exif: true });
    expect(cameraOptions).not.toHaveProperty("allowsMultipleSelection");
  });

  it("rejects when the native module fails", async () => {
    mockPicker.launchImageLibraryAsync.mockRejectedValue(new Error("boom"));

    await expect(pickMedia()).rejects.toThrow("boom");
  });
});

describe("useMediaPicker", () => {
  it("tracks picking around a pick and exposes the latest permission response", async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockPicker.launchImageLibraryAsync.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useMediaPicker());
    expect(result.current.picking).toBe(false);
    expect(result.current.permission).toBeNull();

    let pending: ReturnType<typeof result.current.pick> | undefined;
    await act(async () => {
      pending = result.current.pick();
      await Promise.resolve();
    });
    expect(result.current.picking).toBe(true);

    await act(async () => {
      finish({ canceled: true, assets: null });
      await pending;
    });

    await expect(pending).resolves.toEqual({ status: "canceled" });
    expect(result.current.picking).toBe(false);
    expect(result.current.permission).toEqual(granted);
  });

  it("reports a denial through both the result and permission", async () => {
    mockPicker.getMediaLibraryPermissionsAsync.mockResolvedValue(deniedFinal);
    const { result } = await renderHook(() => useMediaPicker());

    let outcome: Awaited<ReturnType<typeof result.current.pick>> | undefined;
    await act(async () => {
      outcome = await result.current.pick();
    });

    expect(outcome).toEqual({ status: "denied", canAskAgain: false });
    expect(result.current.permission).toEqual(deniedFinal);
    expect(result.current.picking).toBe(false);
  });

  it("resets picking when the native module fails", async () => {
    mockPicker.launchImageLibraryAsync.mockRejectedValue(new Error("boom"));
    const { result } = await renderHook(() => useMediaPicker());

    await act(async () => {
      await expect(result.current.pick()).rejects.toThrow("boom");
    });

    expect(result.current.picking).toBe(false);
  });

  it("still resolves after unmount and updates nothing", async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockPicker.launchImageLibraryAsync.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = await renderHook(() => useMediaPicker());
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    let pending: ReturnType<typeof result.current.pick> | undefined;
    await act(async () => {
      pending = result.current.pick();
      await Promise.resolve();
    });
    await unmount();
    finish({ canceled: true, assets: null });

    await expect(pending).resolves.toEqual({ status: "canceled" });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
