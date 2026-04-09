import { Checkbox } from "@/components/ui/checkbox";
import { Star } from "lucide-react";

interface FilterPanelProps {
  questionCategories: { value: string; label: string }[];
  tempCategories: string[];
  toggleCategory: (category: string) => void;
  difficultyLevels: { value: string; label: string }[];
  tempDifficulties: string[];
  toggleDifficulty: (difficulty: string) => void;
  tempShuffle: boolean;
  setTempShuffle: (value: boolean) => void;
  tempShowFavoritesOnly: boolean;
  setTempShowFavoritesOnly: (value: boolean) => void;
  showNeedsWorkOnly: boolean;
}

export function FilterPanel({
  questionCategories,
  tempCategories,
  toggleCategory,
  difficultyLevels,
  tempDifficulties,
  toggleDifficulty,
  tempShuffle,
  setTempShuffle,
  tempShowFavoritesOnly,
  setTempShowFavoritesOnly,
  showNeedsWorkOnly,
}: FilterPanelProps) {
  return (
    <div className="space-y-5">
      {showNeedsWorkOnly && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
          This round is focused on questions you previously marked as needing more work.
        </div>
      )}

      <div className="space-y-3">
        <label className="text-xs font-medium text-muted-foreground">Categories</label>
        <p className="text-xs text-muted-foreground">Leave unselected to include all categories.</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {questionCategories
            .filter((category) => category.value !== "all")
            .map((category) => (
              <div key={category.value} className="flex items-center space-x-2 rounded-md border bg-background px-2 py-1">
                <Checkbox
                  id={`cat-${category.value}`}
                  checked={tempCategories.includes(category.value)}
                  onCheckedChange={() => toggleCategory(category.value)}
                />
                <label htmlFor={`cat-${category.value}`} className="cursor-pointer text-xs">
                  {category.label}
                </label>
              </div>
            ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
        <div className="flex flex-wrap gap-2">
          {difficultyLevels
            .filter((level) => level.value !== "all")
            .map((level) => (
              <div key={level.value} className="flex items-center space-x-2 rounded-md border bg-background px-3 py-2">
                <Checkbox
                  id={`diff-${level.value}`}
                  checked={tempDifficulties.includes(level.value)}
                  onCheckedChange={() => toggleDifficulty(level.value)}
                />
                <label htmlFor={`diff-${level.value}`} className="cursor-pointer text-xs">
                  {level.label}
                </label>
              </div>
            ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Order & favorites</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex items-center space-x-2 rounded-md border bg-background px-3 py-2">
            <Checkbox
              id="shuffle"
              checked={tempShuffle}
              onCheckedChange={(checked) => setTempShuffle(Boolean(checked))}
            />
            <label htmlFor="shuffle" className="cursor-pointer text-xs">
              Shuffle questions randomly
            </label>
          </div>
          <div className="flex items-center space-x-2 rounded-md border bg-background px-3 py-2">
            <Checkbox
              id="favorites-only"
              checked={tempShowFavoritesOnly}
              onCheckedChange={(checked) => setTempShowFavoritesOnly(Boolean(checked))}
            />
            <label htmlFor="favorites-only" className="flex cursor-pointer items-center gap-1 text-xs">
              <Star className="h-3 w-3 text-amber-500" />
              Favorites only
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
