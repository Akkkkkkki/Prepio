import { NavLink, useLocation } from "react-router-dom";
import { AlertCircle, CheckCircle, Loader2, Sparkles } from "lucide-react";

import Navigation from "@/components/Navigation";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCEPTED_RESUME_TYPES } from "@/lib/resumeUpload";
import { cn } from "@/lib/utils";

import ProfileImportView from "./profile/ProfileImportView";
import ProfileMainView from "./profile/ProfileMainView";
import ProfilePreferencesView from "./profile/ProfilePreferencesView";
import { PROFILE_CV_UPLOAD_ID } from "./profile/profileUtils";
import { useProfileWorkspace } from "./profile/useProfileWorkspace";

type ProfileSurface = "main" | "preferences" | "import";

const profileNavItems: Array<{
  href: string;
  key: ProfileSurface;
  label: string;
}> = [
  { href: "/profile", key: "main", label: "Profile" },
  { href: "/profile/preferences", key: "preferences", label: "Preferences" },
  { href: "/profile/import", key: "import", label: "Import" },
];

const getProfileSurface = (pathname: string): ProfileSurface => {
  if (pathname.startsWith("/profile/import")) {
    return "import";
  }

  if (pathname.startsWith("/profile/preferences")) {
    return "preferences";
  }

  return "main";
};

const Profile = () => {
  const location = useLocation();
  const workspace = useProfileWorkspace();
  const currentSurface = getProfileSurface(location.pathname);

  if (workspace.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-10">
          <div className="mx-auto flex min-h-[420px] max-w-4xl items-center justify-center">
            <Card className="w-full max-w-md text-center">
              <CardHeader>
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
                <CardTitle>Loading Profile</CardTitle>
                <CardDescription>Pulling your structured profile, preferences, and import history.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="main-content" className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {workspace.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{workspace.error}</AlertDescription>
            </Alert>
          ) : null}

          {workspace.success ? (
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle className="h-4 w-4 text-emerald-700" />
              <AlertDescription className="text-emerald-900">{workspace.success}</AlertDescription>
            </Alert>
          ) : null}

          {workspace.bootstrappedFromLegacy ? (
            <Alert className="border-amber-200 bg-amber-50">
              <Sparkles className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-amber-900">
                We prefilled this profile from the last parsed resume. Save once to make it your editable canonical version.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-b pb-3">
            {profileNavItems.map((item) => {
              const isActive = currentSurface === item.key;

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={cn(
                    buttonVariants({ variant: isActive ? "default" : "ghost", size: "sm" }),
                    "rounded-full",
                  )}
                >
                  {item.label}
                  {item.key === "import" && workspace.activeImport ? (
                    <Badge variant={isActive ? "secondary" : "outline"} className="ml-1">
                      Pending
                    </Badge>
                  ) : null}
                </NavLink>
              );
            })}
          </div>

          <input
            id={PROFILE_CV_UPLOAD_ID}
            type="file"
            accept={ACCEPTED_RESUME_TYPES}
            className="hidden"
            onChange={(event) => void workspace.handleFileUpload(event)}
          />

          {currentSurface === "preferences" ? (
            <ProfilePreferencesView workspace={workspace} />
          ) : null}

          {currentSurface === "import" ? <ProfileImportView workspace={workspace} /> : null}

          {currentSurface === "main" ? <ProfileMainView workspace={workspace} /> : null}
        </div>
      </div>

      <AlertDialog open={workspace.showDeleteConfirm} onOpenChange={workspace.setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resume versions</AlertDialogTitle>
            <AlertDialogDescription>
              This removes uploaded files, pasted resume versions, and saved import drafts. Your canonical profile stays in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void workspace.handleDeleteResume()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Profile;
