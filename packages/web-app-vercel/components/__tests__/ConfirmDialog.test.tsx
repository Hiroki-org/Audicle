import { useEffect } from "react";
import { render, renderHook, fireEvent, screen, act } from "@testing-library/react";
import { useConfirmDialog } from "../ConfirmDialog";

type ConfirmDialogApi = ReturnType<typeof useConfirmDialog>;

function ConfirmDialogHarness({
  onReady,
}: {
  onReady: (api: ConfirmDialogApi) => void;
}) {
  const api = useConfirmDialog();

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return <>{api.confirmDialog}</>;
}

describe("useConfirmDialog", () => {
  it("should initialize with no dialog", () => {
    const { result } = renderHook(() => useConfirmDialog());

    expect(result.current.confirmDialog).toBeNull();
  });

  it("should return a Promise from showConfirm and display the dialog", async () => {
    let api: ConfirmDialogApi | null = null;
    render(<ConfirmDialogHarness onReady={(value) => {
      api = value;
    }} />);
    expect(api).not.toBeNull();

    let promise!: Promise<boolean>;

    act(() => {
      promise = api!.showConfirm({
        title: "Test Title",
        message: "Test Message",
      });
    });

    expect(promise).toBeInstanceOf(Promise);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Message")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    });

    await expect(promise).resolves.toBe(false);
    expect(screen.queryByText("Test Title")).toBeNull();
  });

  it("should resolve the Promise to true when onConfirm is called", async () => {
    let api: ConfirmDialogApi | null = null;
    render(<ConfirmDialogHarness onReady={(value) => {
      api = value;
    }} />);
    expect(api).not.toBeNull();

    let promise!: Promise<boolean>;

    act(() => {
      promise = api!.showConfirm({
        title: "Test Title",
        message: "Test Message",
      });
    });

    expect(screen.getByText("Test Title")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "確認" }));
    });

    await expect(promise).resolves.toBe(true);
    expect(screen.queryByText("Test Title")).toBeNull();
  });

  it("should resolve the Promise to false when onCancel is called", async () => {
    let api: ConfirmDialogApi | null = null;
    render(<ConfirmDialogHarness onReady={(value) => {
      api = value;
    }} />);
    expect(api).not.toBeNull();

    let promise!: Promise<boolean>;

    act(() => {
      promise = api!.showConfirm({
        title: "Test Title",
        message: "Test Message",
      });
    });

    expect(screen.getByText("Test Title")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    });

    await expect(promise).resolves.toBe(false);
    expect(screen.queryByText("Test Title")).toBeNull();
  });
});
