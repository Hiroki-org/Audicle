import { renderHook, act } from "@testing-library/react";
import { useConfirmDialog } from "../ConfirmDialog";

describe("useConfirmDialog", () => {
  it("should initialize with no dialog", () => {
    const { result } = renderHook(() => useConfirmDialog());

    expect(result.current.confirmDialog).toBeNull();
  });

  it("should return a Promise from showConfirm and display the dialog", () => {
    const { result } = renderHook(() => useConfirmDialog());

    let promise: Promise<boolean>;
    act(() => {
      promise = result.current.showConfirm({
        title: "Test Title",
        message: "Test Message"
      });
    });

    expect(promise!).toBeInstanceOf(Promise);
    expect(result.current.confirmDialog).not.toBeNull();

    // Check if ConfirmDialog component properties are rendered inside
    const dialogElement = result.current.confirmDialog;
    expect(dialogElement?.props.title).toBe("Test Title");
    expect(dialogElement?.props.message).toBe("Test Message");
  });

  it("should resolve the Promise to true when onConfirm is called", async () => {
    const { result } = renderHook(() => useConfirmDialog());

    let promise: Promise<boolean>;
    act(() => {
      promise = result.current.showConfirm({
        title: "Test Title",
        message: "Test Message"
      });
    });

    const dialogProps = result.current.confirmDialog?.props;

    act(() => {
      dialogProps?.onConfirm();
    });

    const isConfirmed = await promise!;

    expect(isConfirmed).toBe(true);
    expect(result.current.confirmDialog).toBeNull();
  });

  it("should resolve the Promise to false when onCancel is called", async () => {
    const { result } = renderHook(() => useConfirmDialog());

    let promise: Promise<boolean>;
    act(() => {
      promise = result.current.showConfirm({
        title: "Test Title",
        message: "Test Message"
      });
    });

    const dialogProps = result.current.confirmDialog?.props;

    act(() => {
      dialogProps?.onCancel();
    });

    const isConfirmed = await promise!;

    expect(isConfirmed).toBe(false);
    expect(result.current.confirmDialog).toBeNull();
  });
});
