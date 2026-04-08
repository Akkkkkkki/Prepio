import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Play, Settings, Star } from "lucide-react";
import { FilterPanel } from "./FilterPanel";

interface InterviewStageOption {
  id: string;
  name: string;
  questions?: { id: string }[];
  selected: boolean;
}

interface PracticeSetupWizardProps {
  searchId?: string | null;
  company?: string;
  role?: string;
  setupStep: number;
  setupSteps: readonly { key: string; label: string }[];
  selectedPreset: string | null;
  practicePresets: Record<string, { label: string; description: string }>;
  onPresetSelect: (presetKey: string) => void;
  sampleSize: number;
  onSampleSizeChange: (value: number) => void;
  allStages: InterviewStageOption[];
  onStageToggle: (stageId: string) => void;
  selectedStagesCount: number;
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
  rememberDefaults: boolean;
  setRememberDefaults: (value: boolean) => void;
  canProceedFromSetupStep: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onStart: () => void;
  onBack: () => void;
  showNeedsWorkOnly: boolean;
}

export function PracticeSetupWizard({
  company,
  role,
  setupStep,
  setupSteps,
  selectedPreset,
  practicePresets,
  onPresetSelect,
  sampleSize,
  onSampleSizeChange,
  allStages,
  onStageToggle,
  selectedStagesCount,
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
  rememberDefaults,
  setRememberDefaults,
  canProceedFromSetupStep,
  onPrevious,
  onNext,
  onStart,
  onBack,
  showNeedsWorkOnly,
}: PracticeSetupWizardProps) {
  const renderSetupStepContent = () => {
    switch (setupStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(practicePresets).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPresetSelect(key)}
                  className={`rounded-xl border p-4 text-left transition hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                    selectedPreset === key ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{preset.label}</span>
                    {selectedPreset === key && (
                      <Badge variant="secondary" className="text-xs">
                        Selected
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{preset.description}</p>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Number of questions</label>
              <input
                type="number"
                min="1"
                max="100"
                value={sampleSize}
                onChange={(event) => onSampleSizeChange(parseInt(event.target.value, 10) || 10)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Pick 1 to 100 questions for this session. Presets adjust this automatically.
              </p>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose at least one stage to include in this practice run.</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {allStages.map((stage, index) => {
                const totalQuestions = stage.questions?.length || 0;
                return (
                  <div key={stage.id} className="flex items-center space-x-3 rounded-lg border p-3">
                    <Checkbox
                      checked={stage.selected}
                      onCheckedChange={() => onStageToggle(stage.id)}
                      aria-label={`Toggle ${stage.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Stage {index + 1}
                        </Badge>
                        <span className="truncate text-sm font-medium">{stage.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {totalQuestions} question{totalQuestions !== 1 ? "s" : ""} available
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedStagesCount === 0 && (
              <p className="text-xs text-amber-600">Select at least one stage to continue.</p>
            )}
          </div>
        );
      case 2:
        return (
          <FilterPanel
            questionCategories={questionCategories}
            tempCategories={tempCategories}
            toggleCategory={toggleCategory}
            difficultyLevels={difficultyLevels}
            tempDifficulties={tempDifficulties}
            toggleDifficulty={toggleDifficulty}
            tempShuffle={tempShuffle}
            setTempShuffle={setTempShuffle}
            tempShowFavoritesOnly={tempShowFavoritesOnly}
            setTempShowFavoritesOnly={setTempShowFavoritesOnly}
            showNeedsWorkOnly={showNeedsWorkOnly}
          />
        );
      default:
        return (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="mb-2 text-sm font-medium">Session summary</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• {sampleSize} question{sampleSize !== 1 ? "s" : ""} selected</li>
                <li>• {selectedStagesCount} stage{selectedStagesCount !== 1 ? "s" : ""} included</li>
                <li>
                  • Categories: {tempCategories.length
                    ? tempCategories
                        .map((value) => questionCategories.find((category) => category.value === value)?.label)
                        .join(", ")
                    : "All"}
                </li>
                <li>• Difficulty: {tempDifficulties.length ? tempDifficulties.join(", ") : "All levels"}</li>
                <li>• Order: {tempShuffle ? "Shuffled" : "Stage order"}</li>
                <li>• Favorites: {tempShowFavoritesOnly ? "Only favorited questions" : "All questions"}</li>
                {showNeedsWorkOnly && <li>• Focus: questions marked as needing more work</li>}
              </ul>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-defaults"
                checked={rememberDefaults}
                onCheckedChange={(checked) => setRememberDefaults(Boolean(checked))}
              />
              <label htmlFor="remember-defaults" className="text-sm text-muted-foreground">
                Remember these defaults for next time
              </label>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="text-sm text-muted-foreground">
            {company && `${company}`}
            {role && ` - ${role}`}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Configure your practice session
            </CardTitle>
            <CardDescription>
              Step {setupStep + 1} of {setupSteps.length}: {setupSteps[setupStep].label}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              {setupSteps.map((step, index) => (
                <div key={step.key} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      index <= setupStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className={`text-sm ${index === setupStep ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                  {index < setupSteps.length - 1 && <div className="h-px w-6 bg-border" />}
                </div>
              ))}
            </div>

            {renderSetupStepContent()}

            <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
              <Button
                variant="ghost"
                onClick={onPrevious}
                disabled={setupStep === 0}
                className="w-full sm:w-auto"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              {setupStep < setupSteps.length - 1 ? (
                <Button
                  onClick={onNext}
                  disabled={!canProceedFromSetupStep}
                  className="w-full sm:w-auto"
                >
                  Next • {setupSteps[setupStep + 1].label}
                </Button>
              ) : (
                <Button
                  onClick={onStart}
                  disabled={!canProceedFromSetupStep || selectedStagesCount === 0}
                  className="w-full sm:w-auto"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Practice
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
