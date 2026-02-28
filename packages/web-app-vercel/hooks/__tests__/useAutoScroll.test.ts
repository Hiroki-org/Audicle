import { renderHook, act } from "@testing-library/react";
import { useAutoScroll } from "../useAutoScroll";

describe("useAutoScroll", () => {
  let scrollIntoViewMock: jest.Mock;
  let scrollToMock: jest.Mock;
  let consoleLogMock: jest.Mock;
  let consoleWarnMock: jest.Mock;

  beforeEach(() => {
    // Mock scroll methods
    scrollIntoViewMock = jest.fn();
    scrollToMock = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    Element.prototype.scrollTo = scrollToMock;
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    HTMLElement.prototype.scrollTo = scrollToMock;

    // Mock console methods to avoid cluttering test output and to verify calls
    consoleLogMock = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnMock = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Setup DOM
    document.body.innerHTML = `
      <div id="container" style="height: 500px; overflow: auto;">
        <div data-audicle-id="chunk-1" style="height: 100px;">Chunk 1</div>
        <div data-audicle-id="chunk-2" style="height: 100px;">Chunk 2</div>
        <div data-audicle-id="chunk-3" style="height: 100px;">Chunk 3</div>
      </div>
    `;
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
    jest.useRealTimers();
  });

  it("should scroll element into view when currentChunkId changes (window scroll)", () => {
    jest.useFakeTimers();

    renderHook(() =>
      useAutoScroll({
        currentChunkId: "chunk-1",
        enabled: true,
        delay: 0,
      })
    );

    act(() => {
      jest.runAllTimers();
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    // Verify console.log was NOT called
    expect(consoleLogMock).not.toHaveBeenCalledWith(
        expect.stringContaining("[useAutoScroll] ウィンドウスクロール")
    );
  });

  it("should scroll container when containerRef is provided", () => {
    jest.useFakeTimers();

    const container = document.getElementById("container") as HTMLDivElement;
    const containerRef = { current: container };

    // Mock getBoundingClientRect for calculations
    jest.spyOn(container, "getBoundingClientRect").mockReturnValue({
        top: 0,
        height: 500,
        left: 0,
        width: 500,
        right: 500,
        bottom: 500,
        x: 0,
        y: 0,
        toJSON: () => {}
    });

    const element = document.querySelector('[data-audicle-id="chunk-2"]') as HTMLElement;
    jest.spyOn(element, "getBoundingClientRect").mockReturnValue({
        top: 200, // 200px down
        height: 100,
        left: 0,
        width: 100,
        right: 100,
        bottom: 300,
        x: 0,
        y: 200,
        toJSON: () => {}
    });

    renderHook(() =>
      useAutoScroll({
        currentChunkId: "chunk-2",
        containerRef,
        enabled: true,
        delay: 0,
      })
    );

    act(() => {
      jest.runAllTimers();
    });

    expect(scrollToMock).toHaveBeenCalledWith(
        expect.objectContaining({
            behavior: "smooth",
            left: 0,
        })
    );

    // Verify console.log was NOT called
    expect(consoleLogMock).not.toHaveBeenCalledWith(
        expect.stringContaining("[useAutoScroll] コンテナ内スクロール")
    );
  });

  it("should not scroll when enabled is false", () => {
    jest.useFakeTimers();

    renderHook(() =>
      useAutoScroll({
        currentChunkId: "chunk-1",
        enabled: false,
        delay: 0,
      })
    );

    act(() => {
      jest.runAllTimers();
    });

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it("should warn when chunk element is not found", () => {
    jest.useFakeTimers();

    renderHook(() =>
      useAutoScroll({
        currentChunkId: "non-existent-chunk",
        enabled: true,
        delay: 0,
      })
    );

    act(() => {
      jest.runAllTimers();
    });

    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining("[useAutoScroll] チャンクが見つかりません")
    );
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});
