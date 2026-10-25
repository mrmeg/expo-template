/**
 * UploadQueue: one row per entry, the status text for every state, determinate
 * versus indeterminate progress, which row buttons exist and what they pass
 * back, the header action, and the single accessible element per row.
 *
 * `expo-image` is replaced by a `View` that receives every prop.
 */
import React from "react";
import { AccessibilityInfo } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  UploadQueue,
  uploadQueueStatusLabel,
  type UploadQueueEntry,
  type UploadQueueProps,
  type UploadQueueStatus,
} from "../UploadQueue";

jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

const entry = (status: UploadQueueStatus, extra: Partial<UploadQueueEntry> = {}): UploadQueueEntry => ({
  id: `${status}-1`,
  fileName: `${status}.jpg`,
  kind: "image",
  status,
  ...extra,
});

const renderQueue = (entries: UploadQueueEntry[], props: Partial<UploadQueueProps> = {}) =>
  render(<UploadQueue entries={entries} {...props} />);

describe("uploadQueueStatusLabel", () => {
  it.each([
    [entry("queued"), "Waiting"],
    [entry("processing"), "Optimizing…"],
    [entry("processing", { phase: "compressing", progress: 0.4 }), "Optimizing…"],
    [entry("processing", { phase: "converting-video" }), "Converting…"],
    [entry("processing", { phase: "converting-video", progress: 0.424 }), "Converting 42%"],
    [entry("processing", { phase: "converting-video", progress: 7 }), "Converting 100%"],
    [entry("uploading"), "Uploading…"],
    [entry("uploading", { progress: 0.5 }), "Uploading…"],
    [entry("done"), "Uploaded"],
    [entry("failed"), "Failed"],
    [entry("failed", { errorMessage: "File too large" }), "File too large"],
  ])("reads %j as %s", (value, expected) => {
    expect(uploadQueueStatusLabel(value)).toBe(expected);
  });
});

describe("UploadQueue", () => {
  it("renders nothing for an empty queue", async () => {
    await renderQueue([], { title: "Uploads", testID: "queue" });

    expect(screen.queryByTestId("queue")).toBeNull();
    expect(screen.queryByText("Uploads")).toBeNull();
  });

  it("renders a row per entry with its file name and status text", async () => {
    await renderQueue([entry("queued"), entry("uploading"), entry("done")]);

    expect(screen.getByText("queued.jpg")).toBeTruthy();
    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(screen.getByText("uploading.jpg")).toBeTruthy();
    expect(screen.getByText("Uploading…")).toBeTruthy();
    expect(screen.getByText("done.jpg")).toBeTruthy();
    expect(screen.getByText("Uploaded")).toBeTruthy();
  });

  it("draws at most maxVisible rows and sums up the rest in a footer", async () => {
    const entries = ["a", "b", "c", "d", "e"].map((id) => entry("queued", { id, fileName: `${id}.jpg` }));
    await renderQueue(entries, { maxVisible: 2 });

    expect(screen.getByText("a.jpg")).toBeTruthy();
    expect(screen.getByText("b.jpg")).toBeTruthy();
    expect(screen.queryByText("c.jpg")).toBeNull();
    expect(screen.getByText("3 more")).toBeTruthy();
  });

  it("has no footer when every entry fits, and takes a localized moreLabel", async () => {
    const entries = ["a", "b", "c"].map((id) => entry("queued", { id, fileName: `${id}.jpg` }));
    const { rerender } = await renderQueue(entries, { maxVisible: 3 });
    expect(screen.queryByText(/more/)).toBeNull();

    await rerender(<UploadQueue entries={entries} maxVisible={1} moreLabel={(count) => `+${count}`} />);
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("takes a localized statusLabel", async () => {
    await renderQueue([entry("queued"), entry("done")], {
      statusLabel: (e) => (e.status === "queued" ? "En espera" : "Subido"),
    });

    expect(screen.getByText("En espera")).toBeTruthy();
    expect(screen.getByText("Subido")).toBeTruthy();
  });

  it("shows the preview image when there is a previewUri, and a kind icon when there is not", async () => {
    await renderQueue([
      entry("uploading", { id: "a", previewUri: "file:///a.jpg" }),
      entry("queued", { id: "b" }),
      entry("queued", { id: "c", kind: "video" }),
    ]);

    const previews = screen.getAllByTestId("expo-image", { includeHiddenElements: true });
    expect(previews).toHaveLength(1);
    expect(previews[0].props.source).toEqual({ uri: "file:///a.jpg" });
    expect(screen.getAllByTestId("icon-image-off", { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getAllByTestId("icon-play", { includeHiddenElements: true })).toHaveLength(1);
  });

  describe("progress", () => {
    it("is determinate when progress is a number, scaled from 0..1 to 0..100", async () => {
      await renderQueue([entry("processing", { phase: "converting-video", progress: 0.42 })]);

      const bar = screen.getByRole("progressbar");
      expect(bar.props["aria-valuenow"]).toBe(42);
    });

    it("is indeterminate while processing or uploading without a number", async () => {
      await renderQueue([entry("processing", { id: "p" }), entry("uploading", { id: "u" })]);

      const bars = screen.getAllByRole("progressbar");
      expect(bars).toHaveLength(2);
      for (const bar of bars) expect(bar.props["aria-valuenow"]).toBeUndefined();
    });

    it("has no bar for queued, done or failed rows", async () => {
      await renderQueue([entry("queued"), entry("done"), entry("failed")]);

      expect(screen.queryByRole("progressbar")).toBeNull();
    });
  });

  describe("buttons", () => {
    it("shows retry only on failed rows, and passes the id", async () => {
      const onRetry = jest.fn();
      await renderQueue([entry("failed"), entry("done"), entry("queued")], { onRetry });

      expect(screen.getAllByLabelText(/^Retry /)).toHaveLength(1);
      await fireEvent.press(screen.getByLabelText("Retry failed.jpg"));

      expect(onRetry).toHaveBeenCalledWith("failed-1");
    });

    it("shows remove on queued, failed and done rows but not while processing or uploading, and passes the id", async () => {
      const onRemove = jest.fn();
      await renderQueue(
        [entry("queued"), entry("processing"), entry("uploading"), entry("done"), entry("failed")],
        { onRemove },
      );

      expect(screen.getAllByLabelText(/^Remove /)).toHaveLength(3);
      expect(screen.queryByLabelText("Remove processing.jpg")).toBeNull();
      expect(screen.queryByLabelText("Remove uploading.jpg")).toBeNull();
      await fireEvent.press(screen.getByLabelText("Remove done.jpg"));

      expect(onRemove).toHaveBeenCalledWith("done-1");
    });

    it("renders neither without their handlers", async () => {
      await renderQueue([entry("failed"), entry("done")]);

      expect(screen.queryByLabelText(/^Retry /)).toBeNull();
      expect(screen.queryByLabelText(/^Remove /)).toBeNull();
    });

    it("takes localized labels", async () => {
      await renderQueue([entry("failed")], {
        onRetry: jest.fn(),
        onRemove: jest.fn(),
        retryLabel: (name) => `Reintentar ${name}`,
        removeLabel: (name) => `Quitar ${name}`,
      });

      expect(screen.getByLabelText("Reintentar failed.jpg")).toBeTruthy();
      expect(screen.getByLabelText("Quitar failed.jpg")).toBeTruthy();
    });
  });

  describe("header", () => {
    it("shows the title as a header", async () => {
      await renderQueue([entry("queued")], { title: "Uploading" });

      expect(screen.getByRole("header")).toBeTruthy();
      expect(screen.getByText("Uploading")).toBeTruthy();
    });

    it("shows Clear finished only when set and something is done or failed", async () => {
      const onClearFinished = jest.fn();
      const { rerender } = await renderQueue([entry("queued"), entry("uploading")], { onClearFinished });
      expect(screen.queryByText("Clear finished")).toBeNull();

      await rerender(<UploadQueue entries={[entry("queued"), entry("done")]} onClearFinished={onClearFinished} />);
      await fireEvent.press(screen.getByText("Clear finished"));

      expect(onClearFinished).toHaveBeenCalledTimes(1);
    });

    it("shows no Clear finished without a handler, and takes a localized label", async () => {
      const { rerender } = await renderQueue([entry("done")]);
      expect(screen.queryByText("Clear finished")).toBeNull();

      await rerender(<UploadQueue entries={[entry("done")]} onClearFinished={jest.fn()} clearFinishedLabel="Borrar terminados" />);
      expect(screen.getByText("Borrar terminados")).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("reads each row as one element: file name, then status", async () => {
      await renderQueue([entry("queued"), entry("failed", { errorMessage: "Too large" })]);

      expect(screen.getByLabelText("queued.jpg, Waiting")).toBeTruthy();
      expect(screen.getByLabelText("failed.jpg, Too large")).toBeTruthy();
    });

    it("includes the conversion percent in the label", async () => {
      await renderQueue([entry("processing", { phase: "converting-video", progress: 0.25, kind: "video" })]);

      expect(screen.getByLabelText("processing.jpg, Converting 25%")).toBeTruthy();
    });

    describe("announcements", () => {
      let announce: jest.SpyInstance;
      beforeEach(() => {
        announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
      });
      afterEach(() => announce.mockRestore());

      it("announces nothing on first render, even for finished rows", async () => {
        await renderQueue([entry("done"), entry("failed")]);

        expect(announce).not.toHaveBeenCalled();
      });

      it("announces a row once when it moves to done or failed", async () => {
        const { rerender } = await renderQueue([entry("uploading", { id: "a", fileName: "a.jpg" }), entry("uploading", { id: "b", fileName: "b.jpg" })]);

        await rerender(
          <UploadQueue
            entries={[
              entry("done", { id: "a", fileName: "a.jpg" }),
              entry("failed", { id: "b", fileName: "b.jpg", errorMessage: "Too large" }),
            ]}
          />,
        );

        expect(announce).toHaveBeenCalledTimes(2);
        expect(announce).toHaveBeenCalledWith("a.jpg, Uploaded");
        expect(announce).toHaveBeenCalledWith("b.jpg, Too large");
      });

      it("stays quiet while progress ticks or the status text changes within a status", async () => {
        const converting = (progress: number) =>
          entry("processing", { phase: "converting-video", progress, kind: "video" });
        const { rerender } = await renderQueue([converting(0.1)]);

        await rerender(<UploadQueue entries={[converting(0.5)]} />);
        await rerender(<UploadQueue entries={[entry("uploading", { id: "processing-1", fileName: "processing.jpg" })]} />);

        expect(announce).not.toHaveBeenCalled();
      });
    });

    it("keeps the row buttons outside the labelled element", async () => {
      await renderQueue([entry("failed")], { onRetry: jest.fn(), onRemove: jest.fn() });

      const row = screen.getByLabelText("failed.jpg, Failed");
      expect(row.queryAll((node) => node.props.accessibilityLabel === "Retry failed.jpg")).toHaveLength(0);
      expect(screen.getByLabelText("Retry failed.jpg")).toBeTruthy();
    });
  });
});
