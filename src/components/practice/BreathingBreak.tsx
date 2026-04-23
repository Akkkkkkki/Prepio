import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const BREATHING_DISMISSED_KEY = "prepioBreathingDismissed";

const PHASES = [
  { label: "Breathe in...", duration: 4000, scale: 1.5 },
  { label: "Hold...", duration: 4000, scale: 1.5 },
  { label: "Breathe out...", duration: 4000, scale: 1 },
  { label: "Hold...", duration: 4000, scale: 1 },
] as const;

const TOTAL_CYCLES = 3;

interface BreathingBreakProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const BreathingBreak = ({ onComplete, onSkip }: BreathingBreakProps) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleDismiss = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem(BREATHING_DISMISSED_KEY, "true");
    }
  }, [dontShowAgain]);

  const handleSkip = () => {
    handleDismiss();
    onSkip();
  };

  // Start scale(1) on first paint so the first phase transitions from 1 → 1.5.
  useEffect(() => {
    const id = requestAnimationFrame(() => setHasStarted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const phase = PHASES[phaseIndex];
    const timer = setTimeout(() => {
      const nextPhase = phaseIndex + 1;
      if (nextPhase >= PHASES.length) {
        const nextCycle = cycle + 1;
        if (nextCycle >= TOTAL_CYCLES) {
          handleDismiss();
          onCompleteRef.current();
          return;
        }
        setCycle(nextCycle);
        setPhaseIndex(0);
      } else {
        setPhaseIndex(nextPhase);
      }
    }, phase.duration);

    return () => clearTimeout(timer);
  }, [phaseIndex, cycle, handleDismiss]);

  const currentPhase = PHASES[phaseIndex];
  const currentScale = hasStarted ? currentPhase.scale : 1;
  const circleStyle = prefersReducedMotion
    ? undefined
    : {
        transform: `scale(${currentScale})`,
        transition: `transform ${currentPhase.duration}ms var(--motion-ease-in-out)`,
      };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background/95 backdrop-blur-sm">
      <div className="flex flex-1 flex-col items-center justify-center gap-16 px-6 py-16">
        <div
          className="h-32 w-32 rounded-full border-4 border-primary/30 bg-primary/10 will-change-transform"
          style={circleStyle}
          aria-hidden="true"
        />
        <div className="flex flex-col items-center gap-3">
          <p
            className="text-xl font-medium text-foreground"
            aria-live="assertive"
          >
            {currentPhase.label}
          </p>
          <p className="text-sm text-muted-foreground">
            Cycle {cycle + 1} of {TOTAL_CYCLES}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 pb-12">
        <div className="flex items-center gap-2">
          <Checkbox
            id="breathing-dismiss"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
          />
          <Label htmlFor="breathing-dismiss" className="text-sm text-muted-foreground cursor-pointer">
            Don't show again
          </Label>
        </div>
        <Button variant="outline" onClick={handleSkip} className="min-h-[44px] min-w-[120px]">
          Skip
        </Button>
      </div>
    </div>
  );
};

export { BREATHING_DISMISSED_KEY };
