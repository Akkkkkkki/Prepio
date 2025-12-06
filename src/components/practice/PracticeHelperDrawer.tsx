import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildTransition } from "@/lib/motion";

interface PracticeHelperDrawerProps {
  defaultOpen?: boolean;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export const PracticeHelperDrawer = ({
  defaultOpen = false,
  title = "Practice helpers",
  subtitle = "Voice preview & notes autosave locally every few seconds.",
  children,
  className,
}: PracticeHelperDrawerProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "practice-helper-drawer rounded-2xl border bg-muted/20 shadow-sm motion-surface",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-xs"
            aria-expanded={isOpen}
          >
            {isOpen ? "Hide helpers" : "Show helpers"}
            <ChevronDown
              className={cn(
                "h-4 w-4",
                isOpen && "rotate-180"
              )}
              style={{
                transition: buildTransition(["transform"], "fast", "easeInOut"),
              }}
            />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent
        forceMount
        className="motion-collapse border-t overflow-hidden data-[state=closed]:pointer-events-none data-[state=closed]:-translate-y-1 data-[state=closed]:opacity-0 data-[state=closed]:max-h-0 data-[state=closed]:p-0 data-[state=open]:max-h-[640px] data-[state=open]:p-4 data-[state=open]:translate-y-0 data-[state=open]:opacity-100"
        style={{
          transition: buildTransition(
            ["opacity", "transform", "max-height", "padding"],
            "slow",
            "easeInOut"
          ),
        }}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};
