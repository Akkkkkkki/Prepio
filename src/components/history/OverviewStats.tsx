import { Card, CardContent } from "@/components/ui/card";
import type { PracticeHistoryOverviewStats } from "@/services/searchService";

interface OverviewStatsProps {
  stats: PracticeHistoryOverviewStats;
}

const formatDuration = (totalSeconds: number) => {
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
};

export const OverviewStats = ({ stats }: OverviewStatsProps) => {
  const statItems = [
    {
      label: "Total Sessions",
      value: stats.totalSessions.toString(),
      helper: "Completed practice rounds",
    },
    {
      label: "Questions Answered",
      value: stats.totalQuestionsAnswered.toString(),
      helper: "Saved responses across sessions",
    },
    {
      label: "Total Time",
      value: formatDuration(stats.totalTimeSeconds),
      helper: "Time spent actively answering",
    },
    {
      label: "Needs Work",
      value: stats.needsWorkCount.toString(),
      helper: "Questions still marked for review",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statItems.map((item) => (
        <Card key={item.label} className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{item.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
