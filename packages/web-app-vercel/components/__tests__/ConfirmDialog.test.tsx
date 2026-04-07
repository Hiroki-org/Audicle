import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useConfirmDialog } from "../ConfirmDialog";

// テスト用ハーネスコンポーネント
const TestComponent = ({ onResult }: { onResult: (res: boolean) => void }) => {
  const { showConfirm, confirmDialog } = useConfirmDialog();

  return (
    <div>
      <button
        data-testid="trigger-btn"
        onClick={async () => {
          const res = await showConfirm({
            title: "Test Title",
            message: "Test Message",
            confirmText: "Yes",
            cancelText: "No",
          });
          onResult(res);
        }}
      >
        Show Dialog
      </button>
      {confirmDialog}
    </div>
  );
};

describe("useConfirmDialog", () => {
  it("should initialize with no dialog", () => {
    render(<TestComponent onResult={jest.fn()} />);
    expect(screen.queryByText("Test Title")).toBeNull();
  });

  it("should return a Promise from showConfirm and display the dialog", async () => {
    const user = userEvent.setup();
    render(<TestComponent onResult={jest.fn()} />);

    // ダイアログを表示
    await user.click(screen.getByTestId("trigger-btn"));

    // ダイアログが表示されていることを確認
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Message")).toBeInTheDocument();
  });

  it("should resolve the Promise to true when onConfirm is called", async () => {
    const user = userEvent.setup();
    const handleResult = jest.fn();
    render(<TestComponent onResult={handleResult} />);

    await user.click(screen.getByTestId("trigger-btn"));

    // ダイアログが表示されたことを確認
    const confirmBtn = screen.getByRole("button", { name: "Yes" });

    // 確認ボタンをクリック
    await user.click(confirmBtn);

    // Promiseがtrueで解決されたことを確認
    expect(handleResult).toHaveBeenCalledWith(true);

    // ダイアログが消えたことを確認
    expect(screen.queryByText("Test Title")).toBeNull();
  });

  it("should resolve the Promise to false when onCancel is called", async () => {
    const user = userEvent.setup();
    const handleResult = jest.fn();
    render(<TestComponent onResult={handleResult} />);

    await user.click(screen.getByTestId("trigger-btn"));

    // ダイアログが表示されたことを確認
    const cancelBtn = screen.getByRole("button", { name: "No" });

    // キャンセルボタンをクリック
    await user.click(cancelBtn);

    // Promiseがfalseで解決されたことを確認
    expect(handleResult).toHaveBeenCalledWith(false);

    // ダイアログが消えたことを確認
    expect(screen.queryByText("Test Title")).toBeNull();
  });
});
