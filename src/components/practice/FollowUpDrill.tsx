import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface FollowUpDrillProps {
  open: boolean;
  prompt: string;
  isLastQuestion: boolean;
  onContinue: () => void;
}

export const FollowUpDrill = ({
  open,
  prompt,
  isLastQuestion,
  onContinue,
}: FollowUpDrillProps) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onContinue();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Follow-up from the interviewer</DialogTitle>
          <DialogDescription>
            Answer out loud, the way you would in the room. Follow-up answers
            aren't saved.
          </DialogDescription>
        </DialogHeader>
        <p className="text-base font-medium leading-7">{prompt}</p>
        <DialogFooter>
          <Button onClick={onContinue} className="w-full sm:w-auto">
            {isLastQuestion ? "Finish session" : "Continue practicing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
