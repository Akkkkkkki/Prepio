import { useState, useEffect } from "react";
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

const hasPasswordSetupIntent = () => {
  const flow = new URLSearchParams(window.location.search).get("flow");
  const type = new URLSearchParams(window.location.hash.slice(1)).get("type");
  return flow === "invite" || flow === "recovery" || type === "invite" || type === "recovery";
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Keep invite/recovery intent in the provider so lazy route loading cannot miss
  // the Auth event. The query only selects a view; updateUser still requires a session.
  const [linkIntent] = useState(hasPasswordSetupIntent);
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(linkIntent);
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
      // A valid invite/recovery link leaves a session once the client has read the
      // URL. Without one the link was expired, already used, or opened directly, so
      // show an honest error instead of a password form that cannot submit.
      if (linkIntent && !session) {
        setPasswordSetupRequired(false);
        setAuthLinkError(EXPIRED_AUTH_LINK_MESSAGE);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [linkIntent]);

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
    authLinkError,
    finishPasswordSetup: () => setPasswordSetupRequired(false),
    signIn,
    signOut,
    resetPassword,
    resendVerification,
    updatePassword,
  };
}
