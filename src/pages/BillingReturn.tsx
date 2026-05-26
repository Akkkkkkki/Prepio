import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";

import { useAuthContext } from "@/components/AuthProvider";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { getEntitlement, type Entitlement } from "@/services/entitlements";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 15000;

type BillingReturnState = "polling" | "paid" | "timeout";

const isPaid = (entitlement: Entitlement) => entitlement.tier === "paid";

const BillingReturn = () => {
  const { user } = useAuthContext();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<BillingReturnState>("polling");
  const startedAtRef = useRef(Date.now());

  const fallbackHref = useMemo(() => {
    const returnTo = searchParams.get("returnTo");
    return returnTo?.startsWith("/") ? returnTo : "/profile";
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      const entitlement = await getEntitlement(user.id);
      if (cancelled) return;

      if (isPaid(entitlement)) {
        setState("paid");
        return;
      }

      if (Date.now() - startedAtRef.current >= POLL_TIMEOUT_MS) {
        setState("timeout");
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user.id]);

  const isSuccess = state === "paid";
  const heading = isSuccess ? "Subscription active" : "Checking your subscription";
  const body =
    state === "timeout"
      ? "Stripe is still processing the update. You can continue into Prepio and paid features will unlock after the webhook finishes."
      : isSuccess
        ? "Your paid access is ready."
        : "This usually takes a few seconds after Checkout.";

  return (
    <div id="main-content" className="min-h-screen bg-background">
      <Navigation showSearchSelector={false} />
      <main className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center px-4 py-12">
        <section className="w-full space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isSuccess ? (
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            ) : (
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{heading}</h1>
            <p className="text-muted-foreground">{body}</p>
            {sessionId ? (
              <p className="text-xs text-muted-foreground">Checkout session {sessionId}</p>
            ) : null}
          </div>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {isSuccess ? (
              <Button asChild>
                <Link to="/practice">Go to practice</Link>
              </Button>
            ) : null}
            <Button asChild variant={isSuccess ? "outline" : "default"}>
              <Link to={fallbackHref}>Continue to Prepio</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default BillingReturn;
