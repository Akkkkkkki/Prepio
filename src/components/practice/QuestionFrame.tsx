import { forwardRef } from "react";
import { Card, type CardProps } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildTransition } from "@/lib/motion";

type QuestionFrameProps = CardProps & {
  animateIn?: boolean;
};

export const QuestionFrame = forwardRef<HTMLDivElement, QuestionFrameProps>(
  ({ className, children, animateIn = true, style, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(
        "question-frame relative overflow-hidden p-4 sm:p-6 lg:p-8",
        animateIn && "motion-fade-in",
        className
      )}
      style={{
        transition: buildTransition(["transform"], "base", "easeInOut"),
        ...style,
      }}
      {...props}
    >
      {children}
    </Card>
  )
);

QuestionFrame.displayName = "QuestionFrame";
