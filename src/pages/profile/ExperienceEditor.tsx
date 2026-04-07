import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileExperience } from "@/lib/candidateProfile";
import {
  createEmptyExperience,
  createEmptyProfileBullet,
} from "@/lib/candidateProfile";

import { removeArrayItem, updateArrayItem } from "./profileUtils";

interface ExperienceEditorProps {
  experience: ProfileExperience | null;
  onChange: (nextExperience: ProfileExperience) => void;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  open: boolean;
}

const ExperienceEditor = ({
  experience,
  onChange,
  onOpenChange,
  onRemove,
  open,
}: ExperienceEditorProps) => {
  if (!experience) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{experience.title || "New experience"}</DialogTitle>
          <DialogDescription>
            Keep the visible role summary lean while preserving the richer stored metadata underneath.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Company</Label>
            <Input
              value={experience.company}
              onChange={(event) =>
                onChange(createEmptyExperience({ ...experience, company: event.target.value }))
              }
              placeholder="Company"
            />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={experience.title}
              onChange={(event) =>
                onChange(createEmptyExperience({ ...experience, title: event.target.value }))
              }
              placeholder="Title"
            />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={experience.location}
              onChange={(event) =>
                onChange(createEmptyExperience({ ...experience, location: event.target.value }))
              }
              placeholder="Location"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                value={experience.startDate}
                onChange={(event) =>
                  onChange(createEmptyExperience({ ...experience, startDate: event.target.value }))
                }
                placeholder="Jan 2022"
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                value={experience.endDate}
                onChange={(event) =>
                  onChange(createEmptyExperience({ ...experience, endDate: event.target.value }))
                }
                placeholder={experience.current ? "Present" : "Dec 2024"}
                disabled={experience.current}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-dashed p-3">
          <Checkbox
            checked={experience.current}
            onCheckedChange={(checked) =>
              onChange(
                createEmptyExperience({
                  ...experience,
                  current: checked === true,
                  endDate: checked === true ? "" : experience.endDate,
                }),
              )
            }
          />
          <div>
            <p className="text-sm font-medium">Current role</p>
            <p className="text-xs text-muted-foreground">
              Keeps the end date open and marks the role as active.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Summary</Label>
          <Textarea
            value={experience.summary}
            onChange={(event) =>
              onChange(createEmptyExperience({ ...experience, summary: event.target.value }))
            }
            rows={4}
            placeholder="Describe the scope, context, and why this role matters."
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Bullet text</Label>
              <p className="text-xs text-muted-foreground">
                Keep the strongest outcome statements and examples here.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange(
                  createEmptyExperience({
                    ...experience,
                    bullets: [...experience.bullets, createEmptyProfileBullet()],
                  }),
                )
              }
            >
              <Plus className="h-4 w-4" />
              Add bullet
            </Button>
          </div>

          {experience.bullets.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Add the bullet points you want to surface during prep and storytelling.
            </div>
          ) : (
            <div className="space-y-3">
              {experience.bullets.map((bullet, index) => (
                <div key={bullet.id} className="space-y-2 rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`experience-bullet-${bullet.id}`}>Bullet {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        onChange(
                          createEmptyExperience({
                            ...experience,
                            bullets: removeArrayItem(experience.bullets, index),
                          }),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    id={`experience-bullet-${bullet.id}`}
                    value={bullet.text}
                    onChange={(event) =>
                      onChange(
                        createEmptyExperience({
                          ...experience,
                          bullets: updateArrayItem(experience.bullets, index, createEmptyProfileBullet({ ...bullet, text: event.target.value })),
                        }),
                      )
                    }
                    rows={3}
                    placeholder="Led the team, changed the system, and quantified the outcome."
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button type="button" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
            Remove role
          </Button>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExperienceEditor;
