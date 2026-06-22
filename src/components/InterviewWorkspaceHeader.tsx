import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type WorkspaceStage = "plan" | "practice" | "review";

interface InterviewWorkspaceHeaderProps {
  activeStage: WorkspaceStage;
  company?: string | null;
  role?: string | null;
  country?: string | null;
  confidence?: string | null;
  searchId?: string | null;
}

const buildSearchPath = (path: string, searchId?: string | null) =>
  searchId ? `${path}?searchId=${searchId}` : path;

const WORKSPACE_STAGES: Array<{ key: WorkspaceStage; label: string; path: string }> = [
  { key: "plan", label: "Plan", path: "/dashboard" },
  { key: "practice", label: "Practice", path: "/practice" },
  { key: "review", label: "Review", path: "/history" },
];

const InterviewWorkspaceHeader = ({
  activeStage,
  company,
  role,
  country,
  confidence,
  searchId,
}: InterviewWorkspaceHeaderProps) => {
  const title = company || "Selected interview";
  const detail = [role, country].filter(Boolean).join(" · ");

  return (
    <section className="rounded-2xl border border-border/70 bg-background/95 px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Interview
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-lg font-semibold leading-tight sm:text-xl">
              {title}
            </h2>
            {confidence && (
              <Badge variant="secondary" className="capitalize">
                {confidence} confidence
              </Badge>
            )}
          </div>
          {detail && <p className="min-w-0 break-words text-sm text-muted-foreground">{detail}</p>}
        </div>

        <nav
          aria-label="Interview workspace"
          className="grid grid-cols-3 overflow-hidden rounded-xl border bg-muted/40 p-1 text-sm"
        >
          {WORKSPACE_STAGES.map((stage) => {
            const isActive = activeStage === stage.key;

            return (
              <Link
                key={stage.key}
                to={buildSearchPath(stage.path, searchId)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "min-w-0 rounded-lg px-3 py-2 text-center font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {stage.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
};

export default InterviewWorkspaceHeader;
