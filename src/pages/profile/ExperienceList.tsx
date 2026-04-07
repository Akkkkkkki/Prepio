import { useEffect, useState } from "react";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProfileExperience } from "@/lib/candidateProfile";
import { createEmptyExperience } from "@/lib/candidateProfile";

import { removeArrayItem, updateArrayItem } from "./profileUtils";
import ExperienceEditor from "./ExperienceEditor";
import ProfileSectionCard from "./ProfileSectionCard";

interface ExperienceListProps {
  experiences: ProfileExperience[];
  onChange: (nextExperiences: ProfileExperience[]) => void;
}

const formatDates = (experience: ProfileExperience) => {
  const dates = [experience.startDate, experience.current ? "Present" : experience.endDate]
    .filter(Boolean)
    .join(" - ");

  return dates || "Dates not set";
};

const ExperienceList = ({ experiences, onChange }: ExperienceListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingExperience = experiences.find((experience) => experience.id === editingId) ?? null;

  useEffect(() => {
    if (editingId && !editingExperience) {
      setEditingId(null);
    }
  }, [editingExperience, editingId]);

  const handleAdd = () => {
    const nextExperience = createEmptyExperience();
    onChange([...experiences, nextExperience]);
    setEditingId(nextExperience.id);
  };

  const handleRemove = (index: number) => {
    onChange(removeArrayItem(experiences, index));
    if (experiences[index]?.id === editingId) {
      setEditingId(null);
    }
  };

  return (
    <ProfileSectionCard
      title="Experience"
      description="Use compact entries by default, then open a focused editor when you need detail."
      icon={<Briefcase className="h-5 w-5 text-primary" />}
      action={
        <Button type="button" variant="outline" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add role
        </Button>
      }
    >
      {experiences.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-5 text-sm text-muted-foreground">
          Add the roles and bullet points you want to lead with in your profile.
        </div>
      ) : (
        <div className="space-y-3">
          {experiences.map((experience, index) => (
            <div
              key={experience.id}
              className="flex flex-col gap-4 rounded-3xl border border-border/70 p-5 md:flex-row md:items-start md:justify-between"
            >
              <div className="space-y-1">
                <p className="font-medium">{experience.title || "Untitled role"}</p>
                <p className="text-sm text-muted-foreground">
                  {[experience.company || "Company", experience.location].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">{formatDates(experience)}</p>
                {experience.summary ? (
                  <p className="max-w-2xl text-sm text-muted-foreground">{experience.summary}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {experience.bullets.length} bullet{experience.bullets.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(experience.id)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(index)}>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ExperienceEditor
        open={Boolean(editingExperience)}
        experience={editingExperience}
        onOpenChange={(open) => {
          if (!open) {
            setEditingId(null);
          }
        }}
        onChange={(nextExperience) => {
          const currentIndex = experiences.findIndex((experience) => experience.id === nextExperience.id);
          if (currentIndex >= 0) {
            onChange(updateArrayItem(experiences, currentIndex, nextExperience));
          }
        }}
        onRemove={() => {
          const currentIndex = experiences.findIndex((experience) => experience.id === editingId);
          if (currentIndex >= 0) {
            handleRemove(currentIndex);
          }
        }}
      />
    </ProfileSectionCard>
  );
};

export default ExperienceList;
