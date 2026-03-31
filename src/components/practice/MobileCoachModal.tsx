import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  QuestionInsightsPanel,
  type QuestionInsightsData,
} from "@/components/practice/QuestionInsightsPanel";

export interface MobileCoachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: string;
  insights: QuestionInsightsData | null;
}

export const MobileCoachModal = ({
  open,
  onOpenChange,
  question,
  insights,
}: MobileCoachModalProps) => {
  if (!insights) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 rounded-none border-x-0 border-b-0 px-0 pb-0 pt-0 sm:max-w-none"
      >
        <div className="border-b bg-background/98 px-5 py-4 backdrop-blur">
          <SheetHeader className="space-y-2 pr-10 text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Coach notes
            </p>
            <SheetTitle className="text-xl">Strong answers, weak spots, and follow-ups</SheetTitle>
            <SheetDescription className="break-words text-sm leading-6 text-muted-foreground">
              For this question: {question}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
          <QuestionInsightsPanel
            data={insights}
            className="space-y-4 rounded-none border-0 bg-transparent p-0 shadow-none"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
