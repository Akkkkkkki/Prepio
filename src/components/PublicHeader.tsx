import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Brain } from "lucide-react";

import { cn } from "@/lib/utils";

type PublicHeaderProps = {
  actions?: ReactNode;
  className?: string;
};

const PublicHeader = ({ actions, className }: PublicHeaderProps) => {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        className,
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Brain className="h-5 w-5 text-primary" />
          <span className="text-primary">Prepio</span>
        </Link>

        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
};

export default PublicHeader;
