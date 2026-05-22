import { ArrowRight, FileText, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ConversionPanelProps {
  onGenerateFullPlan: () => void;
  onSavePlan: () => void;
}

export const ConversionPanel = ({ onGenerateFullPlan, onSavePlan }: ConversionPanelProps) => (
  <div className="rounded-2xl border bg-card p-4 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-base font-semibold">Turn this into a full prep plan</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Save the preview, add resume or job details, and generate the complete stage-by-stage practice set.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onSavePlan}>
          <Save className="mr-2 h-4 w-4" />
          Save full plan
        </Button>
        <Button type="button" onClick={onGenerateFullPlan}>
          <FileText className="mr-2 h-4 w-4" />
          Generate full practice set
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
);

