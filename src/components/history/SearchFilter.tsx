import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PracticeHistorySession } from "@/services/searchService";

export const HISTORY_FILTER_ALL = "all";

interface SearchFilterProps {
  sessions: PracticeHistorySession[];
  value: string;
  onChange: (value: string) => void;
}

const buildSearchLabel = (session: PracticeHistorySession) => {
  const searchPieces = [
    session.searches?.company,
    session.searches?.role,
    session.searches?.country,
  ].filter(Boolean);

  return searchPieces.join(" • ") || "Untitled research";
};

export const SearchFilter = ({ sessions, value, onChange }: SearchFilterProps) => {
  const options = useMemo(() => {
    const optionMap = new Map<
      string,
      { value: string; label: string; sessionCount: number }
    >();

    sessions.forEach((session) => {
      const existing = optionMap.get(session.search_id);

      if (existing) {
        optionMap.set(session.search_id, {
          ...existing,
          sessionCount: existing.sessionCount + 1,
        });
        return;
      }

      optionMap.set(session.search_id, {
        value: session.search_id,
        label: buildSearchLabel(session),
        sessionCount: 1,
      });
    });

    const nextOptions = Array.from(optionMap.values());
    if (value !== HISTORY_FILTER_ALL && !optionMap.has(value)) {
      nextOptions.unshift({
        value,
        label: "Selected research",
        sessionCount: 0,
      });
    }

    return nextOptions;
  }, [sessions, value]);

  return (
    <div className="w-full max-w-sm space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Filter by research
      </p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="Filter practice history by research">
          <SelectValue placeholder="All searches" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={HISTORY_FILTER_ALL}>All searches</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label} ({option.sessionCount} session{option.sessionCount !== 1 ? "s" : ""})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
