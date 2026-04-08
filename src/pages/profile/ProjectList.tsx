import { useEffect, useState } from "react";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProfileProject } from "@/lib/candidateProfile";
import { createEmptyProject } from "@/lib/candidateProfile";

import { removeArrayItem, updateArrayItem } from "./profileUtils";
import ProfileSectionCard from "./ProfileSectionCard";
import ProjectEditor from "./ProjectEditor";

interface ProjectListProps {
  onChange: (nextProjects: ProfileProject[]) => void;
  projects: ProfileProject[];
}

const ProjectList = ({ onChange, projects }: ProjectListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingProject = projects.find((project) => project.id === editingId) ?? null;

  useEffect(() => {
    if (editingId && !editingProject) {
      setEditingId(null);
    }
  }, [editingId, editingProject]);

  const handleAdd = () => {
    const nextProject = createEmptyProject();
    onChange([...projects, nextProject]);
    setEditingId(nextProject.id);
  };

  const handleRemove = (index: number) => {
    onChange(removeArrayItem(projects, index));
    if (projects[index]?.id === editingId) {
      setEditingId(null);
    }
  };

  return (
    <ProfileSectionCard
      title="Projects"
      description="Keep project entries concise by default, then open a focused editor when more context helps."
      icon={<FolderKanban className="h-5 w-5 text-primary" />}
      action={
        <Button type="button" variant="outline" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add project
        </Button>
      }
    >
      {projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-5 text-sm text-muted-foreground">
          Add side projects, launches, migrations, or internal initiatives worth surfacing.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project, index) => (
            <div
              key={project.id}
              className="flex flex-col gap-4 rounded-3xl border border-border/70 p-5 md:flex-row md:items-start md:justify-between"
            >
              <div className="space-y-1">
                <p className="font-medium">{project.title || "Untitled project"}</p>
                <p className="text-sm text-muted-foreground">
                  {project.technologies.length > 0 ? project.technologies.join(" · ") : "No technologies listed"}
                </p>
                {project.context ? (
                  <p className="max-w-2xl text-sm text-muted-foreground">{project.context}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {project.bullets.length} bullet{project.bullets.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(project.id)}>
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

      <ProjectEditor
        open={Boolean(editingProject)}
        project={editingProject}
        onOpenChange={(open) => {
          if (!open) {
            setEditingId(null);
          }
        }}
        onChange={(nextProject) => {
          const currentIndex = projects.findIndex((project) => project.id === nextProject.id);
          if (currentIndex >= 0) {
            onChange(updateArrayItem(projects, currentIndex, nextProject));
          }
        }}
        onRemove={() => {
          const currentIndex = projects.findIndex((project) => project.id === editingId);
          if (currentIndex >= 0) {
            handleRemove(currentIndex);
          }
        }}
      />
    </ProfileSectionCard>
  );
};

export default ProjectList;
