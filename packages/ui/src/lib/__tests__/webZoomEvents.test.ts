/**
 * The DOM listeners behind `MediaViewer`'s web zoom. The Jest environment has
 * no DOM, so the node is a Node `EventTarget` with a box, and the events are
 * plain `Event`s carrying the fields the handler reads.
 */
import { attachZoomEvents } from "../webZoomEvents";

type Box = { left: number; top: number; width: number; height: number };

function fakeNode(box: Box = { left: 100, top: 50, width: 400, height: 800 }) {
  const target = new EventTarget();
  const add = jest.spyOn(target, "addEventListener");
  const remove = jest.spyOn(target, "removeEventListener");
  return Object.assign(target, { getBoundingClientRect: () => box, add, remove });
}

function wheel(init: Record<string, unknown>) {
  const event = Object.assign(new Event("wheel", { cancelable: true }), {
    deltaY: 0,
    deltaMode: 0,
    ctrlKey: false,
    metaKey: false,
    ...init,
  });
  return { event, preventDefault: jest.spyOn(event, "preventDefault") };
}

describe("attachZoomEvents", () => {
  it("adds the wheel listener as non-passive, so preventDefault can stop the page zooming", () => {
    const node = fakeNode();

    attachZoomEvents(node, { onWheelZoom: jest.fn(), onDoubleClick: jest.fn() });

    expect(node.add).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });
    expect(node.add).toHaveBeenCalledWith("dblclick", expect.any(Function));
    expect(node.add).toHaveBeenCalledWith("dragstart", expect.any(Function));
  });

  it("zooms around the cursor on Ctrl + wheel, and cancels the browser's own zoom", () => {
    const node = fakeNode();
    const onWheelZoom = jest.fn();
    attachZoomEvents(node, { onWheelZoom, onDoubleClick: jest.fn() });

    // The cursor is 50 right of and 100 below the center of a box at (100, 50) sized 400 x 800: center (300, 450).
    const { event, preventDefault } = wheel({ ctrlKey: true, deltaY: -10, clientX: 350, clientY: 550 });
    node.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(onWheelZoom).toHaveBeenCalledTimes(1);
    const [factor, focal] = onWheelZoom.mock.calls[0];
    expect(factor).toBeGreaterThan(1);
    expect(focal).toEqual({ x: 50, y: 100 });
  });

  it("treats Cmd + wheel the same way", () => {
    const node = fakeNode();
    const onWheelZoom = jest.fn();
    attachZoomEvents(node, { onWheelZoom, onDoubleClick: jest.fn() });

    const { event } = wheel({ metaKey: true, deltaY: 10, clientX: 300, clientY: 450 });
    node.dispatchEvent(event);

    expect(onWheelZoom).toHaveBeenCalledTimes(1);
    expect(onWheelZoom.mock.calls[0][0]).toBeLessThan(1);
    expect(onWheelZoom.mock.calls[0][1]).toEqual({ x: 0, y: 0 });
  });

  it("leaves a plain wheel alone: it is the pager's scroll", () => {
    const node = fakeNode();
    const onWheelZoom = jest.fn();
    attachZoomEvents(node, { onWheelZoom, onDoubleClick: jest.fn() });

    const { event, preventDefault } = wheel({ deltaY: 40 });
    node.dispatchEvent(event);

    expect(onWheelZoom).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("reports a double click at its position from the center", () => {
    const node = fakeNode();
    const onDoubleClick = jest.fn();
    attachZoomEvents(node, { onWheelZoom: jest.fn(), onDoubleClick });

    node.dispatchEvent(Object.assign(new Event("dblclick"), { clientX: 120, clientY: 60 }));

    expect(onDoubleClick).toHaveBeenCalledWith({ x: -180, y: -390 });
  });

  it("cancels the browser's native image drag and keeps it from react-native-web, which would end a mouse pan on it", () => {
    const node = fakeNode();
    attachZoomEvents(node, { onWheelZoom: jest.fn(), onDoubleClick: jest.fn() });
    const event = new Event("dragstart", { cancelable: true, bubbles: true });
    const preventDefault = jest.spyOn(event, "preventDefault");
    const stopPropagation = jest.spyOn(event, "stopPropagation");

    node.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
    // The responder system listens on the document, above this node: stopping here is what hides it.
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("stops listening when cleaned up", () => {
    const node = fakeNode();
    const onWheelZoom = jest.fn();
    const detach = attachZoomEvents(node, { onWheelZoom, onDoubleClick: jest.fn() });

    detach();
    node.dispatchEvent(wheel({ ctrlKey: true, deltaY: -10 }).event);

    expect(node.remove).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });
    expect(node.remove).toHaveBeenCalledWith("dragstart", expect.any(Function));
    expect(onWheelZoom).not.toHaveBeenCalled();
  });

  it("does nothing for a node that is not a DOM element", () => {
    expect(() => attachZoomEvents(null, { onWheelZoom: jest.fn(), onDoubleClick: jest.fn() })()).not.toThrow();
    expect(() => attachZoomEvents({}, { onWheelZoom: jest.fn(), onDoubleClick: jest.fn() })()).not.toThrow();
  });
});
