"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";

interface PlaybackSpeedDialProps {
  open: boolean;
  value: number;
  onValueChange: (value: number) => void;
  onOpenChange: (open: boolean) => void;
  speeds?: number[];
}

const DEFAULT_SPEEDS = Array.from({ length: 23 }, (_, i) => 0.8 + i * 0.1);

export function PlaybackSpeedDial({
  open,
  value,
  onValueChange,
  onOpenChange,
  speeds = DEFAULT_SPEEDS,
}: PlaybackSpeedDialProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [totalItemWidth, setTotalItemWidth] = useState(64); // 固定値
  const startXRef = useRef(0);
  const startIndexRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const initialIndex =
    speeds.indexOf(value) !== -1 ? speeds.indexOf(value) : speeds.indexOf(1);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [previewIndex, setPreviewIndex] = useState(initialIndex);

  useEffect(() => {
    const newIndex = speeds.indexOf(value);
    const index = newIndex !== -1 ? newIndex : speeds.indexOf(1);
    const clampedIndex = Math.max(0, Math.min(speeds.length - 1, index));

    setSelectedIndex((prev) => (prev !== clampedIndex ? clampedIndex : prev));
    setPreviewIndex((prev) => (prev !== clampedIndex ? clampedIndex : prev));
  }, [value, speeds]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true);
      startXRef.current = e.clientX;
      startIndexRef.current = selectedIndex;
      setDragOffset(0);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [selectedIndex]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const currentX = e.clientX;
      const totalDeltaX = currentX - startXRef.current;
      setDragOffset(totalDeltaX);

      // プレビュー選択: 中央に来るアイテムを先にハイライトして見せる
      if (totalItemWidth > 0) {
        const deltaIndex = totalDeltaX / totalItemWidth;
        const newPreviewIndex = Math.max(
          0,
          Math.min(speeds.length - 1, startIndexRef.current - deltaIndex)
        );
        setPreviewIndex(newPreviewIndex);
      }
      e.preventDefault();
    },
    [isDragging, totalItemWidth, speeds]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    if (totalItemWidth <= 0) {
      setDragOffset(0);
      return;
    }

    const roundedIndex = Math.round(previewIndex);
    const centerIndex = Math.floor((speeds.length - 1) / 2);
    if (roundedIndex < 0 || roundedIndex > speeds.length - 1) {
      setSelectedIndex(centerIndex);
      setPreviewIndex(centerIndex);
      onValueChange(speeds[centerIndex]);
    } else {
      setSelectedIndex(roundedIndex);
      setPreviewIndex(roundedIndex);
      onValueChange(speeds[roundedIndex]);
    }
    setDragOffset(0);
  }, [previewIndex, totalItemWidth, speeds, onValueChange]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onOpenChange(false);
      }
    },
    [onOpenChange]
  );

  const handleSpeedClick = useCallback(
    (speed: number) => {
      const index = speeds.indexOf(speed);
      if (index !== -1 && index >= 0 && index <= speeds.length - 1) {
        setSelectedIndex(index);
        onValueChange(speed);
        onOpenChange(false);
      }
    },
    [onValueChange, onOpenChange, speeds]
  );

  const handlePresetClick = useCallback(
    (speed: number) => {
      onValueChange(speed);
    },
    [onValueChange]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      // Open時にトラックにフォーカスを当てる
      requestAnimationFrame(() => {
        trackRef.current?.focus();
      });
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [open, onOpenChange]);

  const handleTrackKeyDown = (e: React.KeyboardEvent) => {
    let newIndex;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      newIndex = Math.max(0, selectedIndex - 1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      newIndex = Math.min(speeds.length - 1, selectedIndex + 1);
    } else if (e.key === "Home") {
      newIndex = 0;
    } else if (e.key === "End") {
      newIndex = speeds.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    if (newIndex !== selectedIndex) {
      onValueChange(speeds[newIndex]);
    }
  };

  if (!open) return null;

  const currentSpeed = speeds[Math.round(previewIndex)];

  // 中央に配置するためのtransform計算
  const transformValue =
    totalItemWidth > 0
      ? `translateX(${-(previewIndex * totalItemWidth + totalItemWidth / 2)}px)`
      : "translateX(0px)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full sm:w-[500px] sm:max-w-2xl rounded-t-3xl bg-white dark:bg-gray-900 p-6 shadow-2xl transform transition-transform duration-300 ease-out">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            再生速度
          </h3>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {currentSpeed?.toFixed(1)}x
          </p>
        </div>

        {/* 水平スライダー - 中央インジケーター付きピッカー */}
        <div className="relative mb-8">
          <div className="relative h-24 overflow-hidden">
            {/* 中央インジケーター */}
            <div
              className="absolute left-1/2 top-0 z-10"
              style={{ transform: `translateX(-50%)` }}
            >
              <div className="w-0 h-0 border-l-4 border-r-4 border-b-6 border-l-transparent border-r-transparent border-b-green-600" />
            </div>

            {/* ドラッグ可能なトラック */}
            <div
              ref={trackRef}
              className="relative h-full cursor-pointer focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none rounded-lg"
              role="slider"
              aria-label="再生速度"
              aria-valuemin={speeds[0]}
              aria-valuemax={speeds[speeds.length - 1]}
              aria-valuenow={currentSpeed}
              aria-valuetext={`${currentSpeed?.toFixed(1)}x`}
              tabIndex={0}
              onKeyDown={handleTrackKeyDown}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* 移動する数字リスト */}
              <div
                className="absolute top-0 left-1/2 flex items-center"
                style={{
                  transform: transformValue,
                  transformOrigin: "left",
                  transition: isDragging ? "none" : "transform 0.2s ease-out",
                  pointerEvents: "none",
                }}
              >
                {speeds.map((speed, index) => {
                  return (
                    <div
                      key={speed}
                      ref={index === 0 ? itemRef : null} // 最初のアイテムにrefを設定
                      onClick={() => handleSpeedClick(speed)}
                      data-testid={`speed-option-${speed.toFixed(1)}`}
                      className="flex flex-col items-center justify-center mx-2 transition-all duration-200 cursor-pointer"
                      style={{
                        pointerEvents: "auto",
                      }}
                    >
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                        <span className="text-sm font-medium">
                          {speed.toFixed(1)}x
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 速度範囲ラベル */}
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{speeds[0]}x</span>
            <span>{speeds[speeds.length - 1]}x</span>
          </div>
        </div>
      </div>
    </div>
  );
}
