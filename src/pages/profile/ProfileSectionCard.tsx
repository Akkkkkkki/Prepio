import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfileSectionCardProps {
  action?: ReactNode;
  children: ReactNode;
  description?: string;
  icon?: ReactNode;
  title: string;
}

const ProfileSectionCard = ({
  action,
  children,
  description,
  icon,
  title,
}: ProfileSectionCardProps) => (
  <Card>
    <CardHeader>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </div>
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);

export default ProfileSectionCard;
