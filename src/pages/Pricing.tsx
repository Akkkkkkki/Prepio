import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { useAuthContext } from "@/components/AuthProvider";
import PublicHeader from "@/components/PublicHeader";
import Navigation from "@/components/Navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createAuthReturnState } from "@/lib/researchDraft";
import { cn } from "@/lib/utils";
import { createCheckoutSession, createPortalSession, type BillingCadence, BillingError } from "@/services/billing";
import { getEntitlement, type Entitlement } from "@/services/entitlements";
import { FREE_ENTITLEMENT } from "@/shared/entitlement-rules";

type Plan = {
  cadence: BillingCadence;
  name: string;
  cadenceCopy: string;
  valueCopy: string;
  discountCopy: string;
  bestFor: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    cadence: "monthly",
    name: "Monthly",
    cadenceCopy: "Pay month to month",
    valueCopy: "Keep paid AI feedback available while you are actively interviewing.",
    discountCopy: "Base monthly cadence",
    bestFor: "Short interview loops or one urgent process.",
  },
  {
    cadence: "quarterly",
    name: "Quarterly",
    cadenceCopy: "Three months at a time",
    valueCopy: "Stay consistent across several roles without committing to a full year.",
    discountCopy: "About 50% off rolling monthly",
    bestFor: "A focused search over one hiring season.",
  },
  {
    cadence: "annual",
    name: "Annual",
    cadenceCopy: "A full year of coaching",
    valueCopy: "Make interview prep a standing habit and keep feedback ready whenever a role opens.",
    discountCopy: "About 70% off rolling monthly",
    bestFor: "Ongoing career moves and higher-stakes loops.",
    featured: true,
  },
];

const isBillingCadence = (value: string | null): value is BillingCadence =>
  value === "monthly" || value === "quarterly" || value === "annual";

const getBillingErrorMessage = (error: unknown) => {
  if (error instanceof BillingError) {
    switch (error.code) {
      case "pending_checkout":
        return "You already have a checkout in progress. Finish it in the original tab, or contact support to reset it.";
      case "already_subscribed":
        return "You already have an active subscription. Use Customer Portal to manage your plan.";
      case "no_active_subscription":
      case "no_customer":
        return "We could not find an active subscription to manage yet.";
      case "invalid_cadence":
        return "Choose one of the available billing cadences.";
      case "user_token_required":
      case "Missing bearer token":
        return "Sign in again before changing billing.";
      case "misconfigured":
      case "internal_error":
      case "stripe_error":
      case "function_error":
      case "invalid_response":
        return "Billing is temporarily unavailable. Please try again later.";
      default:
        return "Billing is temporarily unavailable. Please try again later.";
    }
  }

  return "Billing is temporarily unavailable. Please try again later.";
};

const Pricing = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading } = useAuthContext();
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);
  const [isLoadingEntitlement, setIsLoadingEntitlement] = useState(false);
  const [entitlementUserId, setEntitlementUserId] = useState<string | null>(null);
  const [pendingCadence, setPendingCadence] = useState<BillingCadence | "portal" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const autoCheckoutKey = useRef<string | null>(null);

  const checkoutCadence = searchParams.get("checkout");
  const isPaid = entitlement.tier === "paid";
  const isEntitlementReady = !user || entitlementUserId === user.id;

  useEffect(() => {
    let isMounted = true;

    const loadEntitlement = async () => {
      if (!user) {
        setEntitlement(FREE_ENTITLEMENT);
        setEntitlementUserId(null);
        setIsLoadingEntitlement(false);
        return;
      }

      setIsLoadingEntitlement(true);
      setEntitlementUserId(null);
      try {
        const nextEntitlement = await getEntitlement(user.id);
        if (isMounted) {
          setEntitlement(nextEntitlement);
          setEntitlementUserId(user.id);
        }
      } finally {
        if (isMounted) {
          setIsLoadingEntitlement(false);
        }
      }
    };

    loadEntitlement();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const refreshEntitlement = useCallback(async () => {
    if (!user) return FREE_ENTITLEMENT;
    const nextEntitlement = await getEntitlement(user.id);
    setEntitlement(nextEntitlement);
    return nextEntitlement;
  }, [user]);

  const startPortal = useCallback(async () => {
    if (!user) {
      navigate("/auth", {
        state: createAuthReturnState({
          pathname: "/pricing",
          intent: "billing",
          resumeLabel: "Pricing",
        }),
      });
      return;
    }

    setMessage(null);
    setPendingCadence("portal");
    try {
      const result = await createPortalSession();
      window.location.assign(result.url);
    } catch (error) {
      setMessage(getBillingErrorMessage(error));
    } finally {
      setPendingCadence(null);
    }
  }, [navigate, user]);

  const startCheckout = useCallback(
    async (cadence: BillingCadence) => {
      if (!user) {
        navigate("/auth", {
          state: createAuthReturnState({
            pathname: `/pricing?checkout=${cadence}`,
            intent: "billing",
            resumeLabel: "Pricing",
          }),
        });
        return;
      }

      if (isPaid) {
        await startPortal();
        return;
      }

      setMessage(null);
      setPendingCadence(cadence);
      try {
        const result = await createCheckoutSession(cadence);
        window.location.assign(result.url);
      } catch (error) {
        if (error instanceof BillingError && error.code === "already_subscribed") {
          await refreshEntitlement();
        }
        setMessage(getBillingErrorMessage(error));
      } finally {
        setPendingCadence(null);
      }
    },
    [isPaid, navigate, refreshEntitlement, startPortal, user],
  );

  useEffect(() => {
    if (
      loading ||
      isLoadingEntitlement ||
      !isEntitlementReady ||
      !user ||
      !isBillingCadence(checkoutCadence)
    ) {
      return;
    }

    const key = `${user.id}:${checkoutCadence}`;
    if (autoCheckoutKey.current === key) return;
    autoCheckoutKey.current = key;
    setSearchParams({}, { replace: true });
    startCheckout(checkoutCadence);
  }, [
    checkoutCadence,
    isEntitlementReady,
    isLoadingEntitlement,
    loading,
    setSearchParams,
    startCheckout,
    user,
  ]);

  const currentPlanCopy = useMemo(() => {
    if (!isPaid) return null;
    if (!entitlement.cadence) return "Your paid subscription is active.";
    return `Your ${entitlement.cadence} subscription is active.`;
  }, [entitlement.cadence, isPaid]);

  const headerActions = user ? null : (
    <>
      <Button variant="ghost" asChild>
        <Link to="/">Home</Link>
      </Button>
      <Button asChild>
        <Link
          to="/auth"
          state={createAuthReturnState({
            pathname: "/pricing",
            intent: "billing",
            resumeLabel: "Pricing",
          })}
        >
          Sign in
        </Link>
      </Button>
    </>
  );

  return (
    <div id="main-content" className="min-h-screen bg-background">
      {user ? <Navigation showSearchSelector={false} /> : <PublicHeader actions={headerActions} />}

      <main className="container mx-auto max-w-6xl px-4 py-8 md:py-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="space-y-5">
            <Badge variant="secondary" className="w-fit">
              Pricing
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
                Add AI feedback when practice needs a sharper coach.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Research, prep plans, and practice stay free. Paid subscriptions unlock AI feedback
                on saved practice answers, so you can see what to tighten before the real interview.
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 text-primary" />
              <div className="space-y-2">
                <h2 className="text-base font-semibold">What changes when you pay</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Free users can research roles, generate interview plans, practice questions, save
                  sessions, and review history. Paid users add AI answer feedback: strengths,
                  improvements, STAR structure, and one next action.
                </p>
              </div>
            </div>
          </div>
        </section>

        {message && (
          <Alert className="mt-8 border-amber-300 bg-amber-50 text-amber-950">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {isPaid && (
          <Alert className="mt-8 border-emerald-200 bg-emerald-50 text-emerald-950">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{currentPlanCopy}</span>
              <Button
                type="button"
                size="sm"
                onClick={startPortal}
                disabled={pendingCadence === "portal"}
                className="w-full sm:w-auto"
              >
                {pendingCadence === "portal" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening portal
                  </>
                ) : (
                  "Manage subscription"
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const isPending = pendingCadence === plan.cadence;
            const buttonCopy = isPaid ? "Manage subscription" : `Choose ${plan.name.toLowerCase()}`;

            return (
              <article
                key={plan.cadence}
                className={cn(
                  "relative flex min-h-[360px] flex-col rounded-lg border bg-card p-6 shadow-sm",
                  plan.featured && "border-primary shadow-md",
                )}
              >
                {plan.featured && (
                  <Badge className="absolute right-4 top-4">Best value</Badge>
                )}

                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">{plan.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.cadenceCopy}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-3xl font-bold tracking-tight">Paid AI feedback</p>
                    <p className="text-sm font-medium text-primary">{plan.discountCopy}</p>
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground">{plan.valueCopy}</p>
                </div>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>AI feedback on saved practice answers</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Free research and practice remain included</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{plan.bestFor}</span>
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  {loading || isLoadingEntitlement || !isEntitlementReady ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      variant={plan.featured ? "default" : "outline"}
                      onClick={() => (isPaid ? startPortal() : startCheckout(plan.cadence))}
                      disabled={Boolean(pendingCadence)}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening Checkout
                        </>
                      ) : (
                        <>
                          {buttonCopy}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
};

export default Pricing;
