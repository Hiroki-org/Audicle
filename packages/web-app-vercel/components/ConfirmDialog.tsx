"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean; // 削除などの危険な操作の場合true
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = "確認",
  cancelText = "キャンセル",
  isDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <p className="text-gray-700 dark:text-gray-300">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={isDangerous ? "destructive" : "default"} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 確認ダイアログを表示するカスタムフック
 */
export function useConfirmDialog() {
  const [dialog, setDialog] = useState<ConfirmDialogProps | null>(null);

  const showConfirm = useCallback(
    (config: Omit<ConfirmDialogProps, "onConfirm" | "onCancel">) => {
      return new Promise<boolean>((resolve) => {
        setDialog({
          ...config,
          onConfirm: () => {
            resolve(true);
            setDialog(null);
          },
          onCancel: () => {
            resolve(false);
            setDialog(null);
          },
        });
      });
    },
    []
  );

  const confirmDialog = dialog && <ConfirmDialog {...dialog} />;

  return { showConfirm, confirmDialog };
}
