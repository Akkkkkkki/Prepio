import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle, Lock, Mail } from "lucide-react";

import PublicHeader from "@/components/PublicHeader";
import { useAuthContext } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAuthResumeLabel, type AuthReturnState } from "@/lib/researchDraft";

type AuthView = "signin" | "signup" | "reset-password" | "resend-verification" | "set-new-password";

const Auth = () => {
  const [authView, setAuthView] = useState<AuthView>("signin");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [resetEmail, setResetEmail] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, resetPassword, resendVerification, updatePassword } = useAuthContext();
  const { isOffline } = useNetworkStatus();
  const authState = location.state as AuthReturnState | undefined;
  const resumeTarget = getAuthResumeLabel(authState);
  const redirectPath = authState?.from
    ? `${authState.from.pathname}${authState.from.search || ""}`
    : "/dashboard";
  const preferredEmail = signInData.email.trim() || signUpData.email.trim();

  // Listen for Supabase PASSWORD_RECOVERY event to enter the set-new-password view
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoverySession(true);
        setAuthView("set-new-password");
        clearFeedback();
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect authenticated users away — unless they're resetting their password
  useEffect(() => {
    if (user && !isRecoverySession) {
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, redirectPath, user, isRecoverySession]);

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const openView = (view: AuthView) => {
    if (view === "reset-password" && !resetEmail) {
      setResetEmail(preferredEmail);
    }

    if (view === "resend-verification" && !verificationEmail) {
      setVerificationEmail(preferredEmail);
    }

    setAuthView(view);
    clearFeedback();
  };

  const handleInputChange = (
    mode: "signin" | "signup",
    field: "email" | "password" | "confirmPassword",
    value: string,
  ) => {
    if (mode === "signin") {
      setSignInData((prev) => ({ ...prev, [field]: value }));
    } else {
      setSignUpData((prev) => ({ ...prev, [field]: value }));
    }

    setError("");
  };

  const handleSubmit = async (e: React.FormEvent, mode: "signin" | "signup") => {
    e.preventDefault();
    clearFeedback();

    const formData = mode === "signin" ? signInData : signUpData;

    if (mode === "signup" && formData.password !== formData.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      if (isOffline) {
        throw new Error("Reconnect to continue with authentication.");
      }

      if (mode === "signup") {
        const { error: signUpError } = await signUp(formData.email, formData.password);

        if (signUpError) {
          throw signUpError;
        }

        setVerificationEmail(formData.email);
        setSuccess("Account created. Check your email for a verification link.");
      } else {
        const { error: signInError } = await signIn(formData.email, formData.password);

        if (signInError) {
          throw signInError;
        }

        navigate(redirectPath, { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!resetEmail.trim()) {
      setError("Enter the email address tied to your account.");
      return;
    }

    setIsLoading(true);

    try {
      if (isOffline) {
        throw new Error("Reconnect to request a password reset email.");
      }

      const { error: resetError } = await resetPassword(resetEmail.trim());

      if (resetError) {
        throw resetError;
      }

      setSuccess("Password reset email sent. Use the latest email you receive.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!verificationEmail.trim()) {
      setError("Enter the email address you used to sign up.");
      return;
    }

    setIsLoading(true);

    try {
      if (isOffline) {
        throw new Error("Reconnect to resend the verification email.");
      }

      const { error: resendError } = await resendVerification(verificationEmail.trim());

      if (resendError) {
        throw resendError;
      }

      setSuccess("Verification email sent. Check your inbox and spam folder.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't resend the verification email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsLoading(true);

    try {
      if (isOffline) {
        throw new Error("Reconnect to set your new password.");
      }

      const { error: updateError } = await updatePassword(newPassword);

      if (updateError) {
        throw updateError;
      }

      setIsRecoverySession(false);
      setSuccess("Password updated. You're now signed in.");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't update your password.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderSharedAlerts = () => (
    <>
      {resumeTarget && (
        <Alert className="mb-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Continue to {resumeTarget}.
            {authState?.source === "research_home" &&
              " We kept your research draft and will restore it when you return."}
          </AlertDescription>
        </Alert>
      )}

      {isOffline && (
        <Alert className="mb-5 border-amber-300 bg-amber-50 text-amber-950">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You&apos;re offline. Sign-in, sign-up, password reset, and verification resend stay unavailable until you reconnect.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-5 border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </>
  );

  const renderSignInAndSignUp = () => (
    <Tabs
      value={authView === "signup" ? "signup" : "signin"}
      onValueChange={(value) => openView(value as "signin" | "signup")}
      className="w-full"
    >
      <TabsList className="mb-6 grid w-full grid-cols-2">
        <TabsTrigger value="signin">Sign In</TabsTrigger>
        <TabsTrigger value="signup">Sign Up</TabsTrigger>
      </TabsList>

      <TabsContent value="signin">
        <form onSubmit={(e) => handleSubmit(e, "signin")} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signin-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="signin-email"
                type="email"
                placeholder="your@email.com"
                value={signInData.email}
                onChange={(e) => handleInputChange("signin", "email", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="signin-password"
                type="password"
                placeholder="••••••••"
                value={signInData.password}
                onChange={(e) => handleInputChange("signin", "password", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || isOffline}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-sm">
          <Button
            type="button"
            variant="link"
            className="h-auto justify-start px-0"
            onClick={() => openView("reset-password")}
          >
            Forgot password?
          </Button>
          <Button
            type="button"
            variant="link"
            className="h-auto justify-start px-0"
            onClick={() => openView("resend-verification")}
          >
            Resend verification email
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="signup">
        <form onSubmit={(e) => handleSubmit(e, "signup")} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="signup-email"
                type="email"
                placeholder="your@email.com"
                value={signUpData.email}
                onChange={(e) => handleInputChange("signup", "email", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                value={signUpData.password}
                onChange={(e) => handleInputChange("signup", "password", e.target.value)}
                className="pl-10"
                minLength={6}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">At least 6 characters.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-confirm-password">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="signup-confirm-password"
                type="password"
                placeholder="••••••••"
                value={signUpData.confirmPassword}
                onChange={(e) => handleInputChange("signup", "confirmPassword", e.target.value)}
                className="pl-10"
                minLength={6}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || isOffline}>
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-sm">
          <Button
            type="button"
            variant="link"
            className="h-auto justify-start px-0"
            onClick={() => openView("resend-verification")}
          >
            Already signed up? Resend verification email.
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );

  const renderResetPassword = () => (
    <>
      <form onSubmit={handleResetPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              placeholder="your@email.com"
              value={resetEmail}
              onChange={(e) => {
                setResetEmail(e.target.value);
                setError("");
              }}
              className="pl-10"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || isOffline}>
          {isLoading ? "Sending reset link..." : "Send reset link"}
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-2 text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto justify-start px-0"
          onClick={() => openView("signin")}
        >
          Back to sign in
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto justify-start px-0"
          onClick={() => openView("resend-verification")}
        >
          Need another verification email?
        </Button>
      </div>
    </>
  );

  const renderResendVerification = () => (
    <>
      <form onSubmit={handleResendVerification} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="verification-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="verification-email"
              type="email"
              placeholder="your@email.com"
              value={verificationEmail}
              onChange={(e) => {
                setVerificationEmail(e.target.value);
                setError("");
              }}
              className="pl-10"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || isOffline}>
          {isLoading ? "Resending..." : "Resend verification email"}
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-2 text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto justify-start px-0"
          onClick={() => openView("signin")}
        >
          Back to sign in
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto justify-start px-0"
          onClick={() => openView("reset-password")}
        >
          Forgot password instead?
        </Button>
      </div>
    </>
  );

  const renderSetNewPassword = () => (
    <>
      <form onSubmit={handleSetNewPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError("");
              }}
              className="pl-10"
              minLength={6}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">At least 6 characters.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-new-password">Confirm new password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirm-new-password"
              type="password"
              placeholder="••••••••"
              value={confirmNewPassword}
              onChange={(e) => {
                setConfirmNewPassword(e.target.value);
                setError("");
              }}
              className="pl-10"
              minLength={6}
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || isOffline}>
          {isLoading ? "Updating password..." : "Set new password"}
        </Button>
      </form>
    </>
  );

  const cardCopy =
    authView === "set-new-password"
      ? {
          title: "Set a new password",
          description: "Choose a new password for your account.",
        }
      : authView === "reset-password"
        ? {
            title: "Reset password",
            description: "We'll send a recovery link to your email.",
          }
        : authView === "resend-verification"
          ? {
              title: "Resend verification",
              description: "Check your inbox for the latest link.",
            }
          : {
              title: "Welcome",
              description: resumeTarget ? `Sign in to continue.` : "Sign in or create an account.",
            };

  return (
    <div id="main-content" className="min-h-screen bg-background">
      <PublicHeader
        actions={
          <Button variant="ghost" asChild>
            <Link to="/">Back to home</Link>
          </Button>
        }
      />

      <div className="flex justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-primary">Prepio</span>
            </h1>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle>{cardCopy.title}</CardTitle>
              <CardDescription>{cardCopy.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {renderSharedAlerts()}

              {authView === "set-new-password"
                ? renderSetNewPassword()
                : authView === "reset-password"
                  ? renderResetPassword()
                  : authView === "resend-verification"
                    ? renderResendVerification()
                    : renderSignInAndSignUp()}

              <p className="mt-6 text-center text-xs text-muted-foreground">
                By continuing, you agree to the current Prepio terms and privacy policy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
