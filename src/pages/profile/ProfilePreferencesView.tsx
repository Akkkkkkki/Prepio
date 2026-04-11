import { MapPin, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import ProfileHeader from "./ProfileHeader";
import ProfileSectionCard from "./ProfileSectionCard";
import { splitCsv } from "./profileUtils";
import type { ProfileLevel, ProfileWorkspaceState } from "./useProfileWorkspace";

interface ProfilePreferencesViewProps {
  workspace: ProfileWorkspaceState;
}

const CsvField = ({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string[]) => void;
  placeholder: string;
  value: string[];
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Textarea
      value={value.join(", ")}
      onChange={(event) => onChange(splitCsv(event.target.value))}
      rows={3}
      placeholder={placeholder}
    />
  </div>
);

const ProfilePreferencesView = ({ workspace }: ProfilePreferencesViewProps) => {
  const {
    handleSaveLevel,
    isPendingTransition,
    isSaving,
    isSavingLevel,
    profile,
    saveProfile,
    level,
    updateProfile,
  } = workspace;

  return (
    <div className="space-y-6">
      <ProfileHeader
        title="Preferences"
        status="These settings influence research defaults and prep framing, not the public-facing profile."
        description="Keep role targets, constraints, and framing notes here so the main profile can stay clean and familiar."
        actions={
          <Button type="button" onClick={() => void saveProfile()} disabled={isSaving || isPendingTransition}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        }
      />

      <ProfileSectionCard
        title="Research defaults"
        description="These values shape search defaults and how prep is framed across the product."
        icon={<Settings2 className="h-5 w-5 text-primary" />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <CsvField
            label="Target roles"
            value={profile.preferences.targetRoles}
            onChange={(targetRoles) =>
              updateProfile({
                ...profile,
                preferences: { ...profile.preferences, targetRoles },
              })
            }
            placeholder="Staff PM, product lead, growth lead"
          />
          <CsvField
            label="Target industries"
            value={profile.preferences.targetIndustries}
            onChange={(targetIndustries) =>
              updateProfile({
                ...profile,
                preferences: { ...profile.preferences, targetIndustries },
              })
            }
            placeholder="SaaS, fintech, healthcare"
          />
          <CsvField
            label="Preferred locations"
            value={profile.preferences.locations}
            onChange={(locations) =>
              updateProfile({
                ...profile,
                preferences: { ...profile.preferences, locations },
              })
            }
            placeholder="London, remote, New York"
          />
          <CsvField
            label="Work modes"
            value={profile.preferences.workModes}
            onChange={(workModes) =>
              updateProfile({
                ...profile,
                preferences: { ...profile.preferences, workModes },
              })
            }
            placeholder="Remote, hybrid, onsite"
          />
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="profile-preferences-notes">Notes</Label>
            <Textarea
              id="profile-preferences-notes"
              value={profile.preferences.notes}
              onChange={(event) =>
                updateProfile({
                  ...profile,
                  preferences: { ...profile.preferences, notes: event.target.value },
                })
              }
              rows={5}
              placeholder="Add constraints, role framing, or context that should influence research and prep."
            />
          </div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Experience level"
        description="This setting stays separate because it influences defaults outside the profile document itself."
        icon={<MapPin className="h-5 w-5 text-primary" />}
      >
        <div className="max-w-sm space-y-2">
          <Label htmlFor="profile-level">Experience level</Label>
          <Select value={level} onValueChange={(value) => void handleSaveLevel(value as ProfileLevel)}>
            <SelectTrigger id="profile-level">
              <SelectValue placeholder="Select experience level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="mid">Mid-level</SelectItem>
              <SelectItem value="senior_ic">Senior IC</SelectItem>
              <SelectItem value="people_manager">People manager</SelectItem>
            </SelectContent>
          </Select>
          {isSavingLevel ? (
            <p className="text-xs text-muted-foreground">Saving experience level...</p>
          ) : null}
        </div>
      </ProfileSectionCard>
    </div>
  );
};

export default ProfilePreferencesView;
