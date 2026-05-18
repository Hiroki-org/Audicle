"use client";

import { Button } from "@/components/ui/button";
import type { Period } from "@/types/stats";

interface PeriodFilterProps {
  activePeriod: Period;
  onPeriodChange: (period: Period) => void;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "今日",
  week: "今週",
  month: "今月",
  all: "全期間",
};

export function PeriodFilter({
  activePeriod,
  onPeriodChange,
}: PeriodFilterProps) {
  const periods: Period[] = ["today", "week", "month", "all"];

  return (
    <div className="flex gap-2 flex-wrap">
      {periods.map((period) => (
        <Button
          key={period}
          onClick={() => onPeriodChange(period)}
          variant={activePeriod === period ? "default" : "outline"}
          size="sm"
          className={
            activePeriod === period
              ? "bg-primary hover:bg-primary/90 text-white border-primary"
              : "border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-900"
          }
        >
          {PERIOD_LABELS[period]}
        </Button>
      ))}
    </div>
  );
}
