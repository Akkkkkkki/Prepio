import type { ReactNode } from "react";

interface ProfileHeaderProps {
  actions?: ReactNode;
  description?: string;
  status?: ReactNode;
  title: string;
}

const ProfileHeader = ({ actions, description, status, title }: ProfileHeaderProps) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div className="space-y-2">
      {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
  </div>
);

export default ProfileHeader;
