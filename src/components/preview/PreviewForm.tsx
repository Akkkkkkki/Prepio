import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PreviewFormProps {
  company: string;
  role: string;
  isLoading: boolean;
  onCompanyChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onSubmit: () => void;
}

export const PreviewForm = ({
  company,
  role,
  isLoading,
  onCompanyChange,
  onRoleChange,
  onSubmit,
}: PreviewFormProps) => (
  <form
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
    className="space-y-4"
  >
    <div className="space-y-2">
      <Label htmlFor="guest-company">Company *</Label>
      <Input
        id="guest-company"
        placeholder="e.g. Stripe, OpenAI, Ramp"
        value={company}
        onChange={(event) => onCompanyChange(event.target.value)}
        autoComplete="organization"
        required
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="guest-role">Role (optional)</Label>
      <Input
        id="guest-role"
        placeholder="e.g. Product Manager"
        value={role}
        onChange={(event) => onRoleChange(event.target.value)}
        autoComplete="organization-title"
      />
    </div>

    <Button type="submit" className="w-full motion-cta" size="lg" disabled={!company.trim() || isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Building preview
        </>
      ) : (
        <>
          <Search className="mr-2 h-4 w-4" />
          Preview my prep
        </>
      )}
    </Button>
    <p className="text-center text-xs text-muted-foreground">
      No resume needed. No account needed for preview.
    </p>
  </form>
);

