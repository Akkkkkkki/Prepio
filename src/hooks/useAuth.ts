import { useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';

// Only password recovery may carry `flow=recovery`: that query selects the
// set-new-password view, so a signup-verification link must land on plain /auth.
const getAuthRedirectUrl = (flow?: "recovery") =>
  typeof window === "undefined"
    ? undefined
    : `${window.location.origin}/auth${flow ? `?flow=${flow}` : ""}`;

export const EXPIRED_AUTH_LINK_MESSAGE =
  "This invite or password reset link is invalid or has expired. Request a new reset link, or ask the person who invited you to send a new invite.";

const readAuthLink = () => {
  if (typeof window === "undefined") return { intent: false, accessToken: null };
  const flow = new URLSearchParams(window.location.search).get("flow");
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const type = hash.get("type");
  const linkType = type === "invite" || type === "recovery";
  return {
    intent: flow === "invite" || flow === "recovery" || linkType,
    accessToken: linkType ? hash.get("access_token") : null,
  };
};

// Read at module load: supabase-js clears the token hash once it has exchanged it,
// and a failed link keeps any stored session, which may belong to another account.
// Only a session carrying this link's own token may set a password.
const initialAuthLink = readAuthLink();

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Keep password-setup state in the provider so lazy route loading cannot miss
  // the Auth event.
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(false);
  const [authLinkChecking, setAuthLinkChecking] = useState(initialAuthLink.intent);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") setPasswordSetupRequired(true);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // An expired, reused or bare link leaves no session of its own: show an
      // honest error instead of a password form for whoever is signed in.
      if (initialAuthLink.intent) {
        const fromLink = Boolean(initialAuthLink.accessToken) &&
          session?.access_token === initialAuthLink.accessToken;
        if (fromLink) setPasswordSetupRequired(true);
        else setAuthLinkError(EXPIRED_AUTH_LINK_MESSAGE);
        setAuthLinkChecking(false);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearAuthLinkError = useCallback(() => setAuthLinkError(null), []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl("recovery"),
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const resendVerification = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  return {
    user,
    session,
    loading,
    passwordSetupRequired,
    authLinkChecking,
    authLinkError,
    clearAuthLinkError,
    finishPasswordSetup: () => setPasswordSetupRequired(false),
    signIn,
    signOut,
    resetPassword,
    resendVerification,
    updatePassword,
  };
}
