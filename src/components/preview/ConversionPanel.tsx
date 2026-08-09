import { ArrowRight, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ConversionPanelProps {
  onGenerateFullPlan: () => void;
}

export const ConversionPanel = ({ onGenerateFullPlan }: ConversionPanelProps) => (
  <div className="rounded-2xl border bg-card p-4 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-base font-semibold">Turn this into a full prep plan</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Sign in to save this preview, add resume or job details, and generate the complete stage-by-stage
          practice set.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" onClick={onGenerateFullPlan}>
          <FileText className="mr-2 h-4 w-4" />
          Sign in to generate full practice set
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
);
