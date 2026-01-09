"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ReputationScoreProps = {
  score: number;
};

export function ReputationScore({ score }: ReputationScoreProps) {
  const percentage = Math.round(score * 100);

  const getProgressColor = () => {
    if (score < 0.4) return "bg-red-500";
    if (score < 0.7) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reputation Score</h3>
        <span className="text-xl font-bold text-primary">{percentage}%</span>
      </div>
      <Progress
        value={percentage}
        className="h-3"
        indicatorClassName={cn("transition-colors duration-500", getProgressColor())}
      />
    </div>
  );
}
