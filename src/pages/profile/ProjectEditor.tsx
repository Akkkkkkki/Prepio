import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import type { ProfileProject } from "@/lib/candidateProfile";
import {
  createEmptyProfileBullet,
  createEmptyProfileLink,
  createEmptyProject,
} from "@/lib/candidateProfile";

import { removeArrayItem, splitCsv, updateArrayItem } from "./profileUtils";

interface ProjectEditorProps {
  onChange: (nextProject: ProfileProject) => void;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  open: boolean;
  project: ProfileProject | null;
}

const ProjectEditor = ({
  onChange,
  onOpenChange,
  onRemove,
  open,
  project,
}: ProjectEditorProps) => {
  if (!project) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project.title || "New project"}</DialogTitle>
          <DialogDescription>
            Keep project context visible here while preserving stored tags and metadata behind the scenes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={project.title}
              onChange={(event) => onChange(createEmptyProject({ ...project, title: event.target.value }))}
              placeholder="Project title"
            />
          </div>
          <div className="space-y-2">
            <Label>Technologies</Label>
            <Input
              value={project.technologies.join(", ")}
              onChange={(event) =>
                onChange(createEmptyProject({ ...project, technologies: splitCsv(event.target.value) }))
              }
              placeholder="React, Python, SQL"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Context</Label>
          <Textarea
            value={project.context}
            onChange={(event) => onChange(createEmptyProject({ ...project, context: event.target.value }))}
            rows={4}
            placeholder="What problem did this project solve, and why does it matter?"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Links</Label>
              <p className="text-xs text-muted-foreground">Add the URLs that support this project.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange(
                  createEmptyProject({
                    ...project,
                    links: [...project.links, createEmptyProfileLink({ label: "Project link" })],
                  }),
                )
              }
            >
              <Plus className="h-4 w-4" />
              Add link
            </Button>
          </div>

          {project.links.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Add launch URLs, repos, demos, or write-ups.
            </div>
          ) : (
            <div className="space-y-3">
              {project.links.map((link, index) => (
                <div key={link.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1.8fr_auto]">
                  <Input
                    value={link.label}
                    onChange={(event) =>
                      onChange(
                        createEmptyProject({
                          ...project,
                          links: updateArrayItem(
                            project.links,
                            index,
                            createEmptyProfileLink({ ...link, label: event.target.value }),
                          ),
                        }),
                      )
                    }
                    placeholder="Label"
                  />
                  <Input
                    value={link.url}
                    onChange={(event) =>
                      onChange(
                        createEmptyProject({
                          ...project,
                          links: updateArrayItem(
                            project.links,
                            index,
                            createEmptyProfileLink({ ...link, url: event.target.value }),
                          ),
                        }),
                      )
                    }
                    placeholder="https://example.com"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onChange(
                        createEmptyProject({
                          ...project,
                          links: removeArrayItem(project.links, index),
                        }),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Bullet text</Label>
              <p className="text-xs text-muted-foreground">
                Keep the outcomes, details, and examples you want available in prep.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange(
                  createEmptyProject({
                    ...project,
                    bullets: [...project.bullets, createEmptyProfileBullet()],
                  }),
                )
              }
            >
              <Plus className="h-4 w-4" />
              Add bullet
            </Button>
          </div>

          {project.bullets.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Add project bullets only when they improve how this work is explained.
            </div>
          ) : (
            <div className="space-y-3">
              {project.bullets.map((bullet, index) => (
                <div key={bullet.id} className="space-y-2 rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`project-bullet-${bullet.id}`}>Bullet {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        onChange(
                          createEmptyProject({
                            ...project,
                            bullets: removeArrayItem(project.bullets, index),
                          }),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    id={`project-bullet-${bullet.id}`}
                    value={bullet.text}
                    onChange={(event) =>
                      onChange(
                        createEmptyProject({
                          ...project,
                          bullets: updateArrayItem(project.bullets, index, createEmptyProfileBullet({ ...bullet, text: event.target.value })),
                        }),
                      )
                    }
                    rows={3}
                    placeholder="Describe the project in terms of context, action, and result."
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button type="button" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
            Remove project
          </Button>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectEditor;
