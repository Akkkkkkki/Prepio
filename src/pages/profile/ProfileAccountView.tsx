import { useState } from "react";
import { Download, FileText, KeyRound, Mail, ShieldAlert, Trash2 } from "lucide-react";

import { useAuthContext } from "@/components/AuthProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AccountError,
  deleteAccount,
  updateAccountEmail,
  updateAccountPassword,
} from "@/services/account";

import {
  buildProfileExportPayload,
  downloadJsonFile,
  openProfilePdfPrintView,
} from "./accountExport";
import ProfileSectionCard from "./ProfileSectionCard";
import type { ProfileWorkspaceState } from "./useProfileWorkspace";

interface ProfileAccountViewProps {
  workspace: ProfileWorkspaceState;
}

const getAccountErrorMessage = (error: unknown) => {
  if (error instanceof AccountError) {
    switch (error.code) {
      case "user_token_required":
      case "Missing bearer token":
        return "Sign in again before changing account settings.";
      case "storage_delete_failed":
        return "We could not remove stored account files, so the account was not deleted.";
      case "auth_delete_failed":
        return "We could not delete the account. Please try again.";
      default:
        return error.message || "Account settings are temporarily unavailable.";
    }
  }

  return error instanceof Error ? error.message : "Account settings are temporarily unavailable.";
};

const ProfileAccountView = ({ workspace }: ProfileAccountViewProps) => {
  const { user } = useAuthContext();
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleEmailSave = async () => {
    const nextEmail = email.trim();
    if (!nextEmail || nextEmail === user?.email) return;

    setIsSavingEmail(true);
    setError(null);
    setStatus(null);

    try {
      await updateAccountEmail(nextEmail);
      setStatus("Check both email inboxes to confirm the account email change.");
    } catch (nextError) {
      setError(getAccountErrorMessage(nextError));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handlePasswordSave = async () => {
    setError(null);
    setStatus(null);

    if (password.length < 8) {
      setError("Use at least 8 characters for the new password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSavingPassword(true);

    try {
      await updateAccountPassword(password);
      setPassword("");
      setConfirmPassword("");
      setStatus("Password updated.");
    } catch (nextError) {
      setError(getAccountErrorMessage(nextError));
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleJsonExport = () => {
    const payload = buildProfileExportPayload(workspace.profile, user?.email);
    downloadJsonFile("prepio-profile-export.json", payload);
  };

  const handlePdfExport = () => {
    try {
      openProfilePdfPrintView(workspace.profile, user?.email);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not open the PDF export.");
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setError(null);
    setStatus(null);

    try {
      await deleteAccount();
      window.location.assign("/");
    } catch (nextError) {
      setError(getAccountErrorMessage(nextError));
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage sign-in details, export your saved profile, and delete your account data.
        </p>
      </div>

      {status ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ProfileSectionCard
        title="Sign-in details"
        description="Email changes may require confirmation before the new address is active."
        icon={<Mail className="h-5 w-5 text-primary" />}
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
          <Button
            type="button"
            onClick={() => void handleEmailSave()}
            disabled={isSavingEmail || !email.trim() || email.trim() === user?.email}
          >
            {isSavingEmail ? "Saving..." : "Change email"}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="account-password">New password</Label>
            <Input
              id="account-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-password-confirm">Confirm password</Label>
            <Input
              id="account-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            type="button"
            onClick={() => void handlePasswordSave()}
            disabled={isSavingPassword || !password || !confirmPassword}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {isSavingPassword ? "Saving..." : "Change password"}
          </Button>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Export profile"
        description="Download the structured candidate profile Prepio uses for research and practice."
        icon={<Download className="h-5 w-5 text-primary" />}
      >
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={handleJsonExport}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          <Button type="button" variant="outline" onClick={handlePdfExport}>
            <FileText className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Delete account"
        description="Deletes your auth account after stored resume files and practice audio are removed."
        icon={<ShieldAlert className="h-5 w-5 text-destructive" />}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This removes profile data, CV imports, uploaded resumes, research, practice sessions,
            answer feedback, and billing entitlement rows owned by this account.
          </p>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="delete-confirmation">Type DELETE to continue</Label>
            <Input
              id="delete-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteConfirmation !== "DELETE" || isDeletingAccount}
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete account
          </Button>
        </div>
      </ProfileSectionCard>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your Prepio account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your sign-in, profile, CV files, research, practice
              history, answer feedback, and subscription entitlement records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteAccount()}
              disabled={isDeletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAccount ? "Deleting..." : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfileAccountView;
