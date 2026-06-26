import { useEffect, useState, type ReactNode } from "react";
import { Award, BookOpen, CreditCard, GraduationCap, Languages, Loader2, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuthContext } from "@/components/AuthProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmptyCertification,
  createEmptyEducation,
  createEmptyLanguage,
  createEmptySkillGroup,
} from "@/lib/candidateProfile";
import { createPortalSession, BillingError } from "@/services/billing";
import { getEntitlement, type Entitlement } from "@/services/entitlements";
import { FREE_ENTITLEMENT } from "@/shared/entitlement-rules";

import ProfileHeader from "./ProfileHeader";
import ProfileSectionCard from "./ProfileSectionCard";
import ProfileSummaryCard from "./ProfileSummaryCard";
import {
  formatResumeLabel,
  PROFILE_MAIN_SECTION_ORDER,
  removeArrayItem,
  updateArrayItem,
  type MainProfileSectionId,
} from "./profileUtils";
import type { ProfileWorkspaceState } from "./useProfileWorkspace";
import ExperienceList from "./ExperienceList";
import ProjectList from "./ProjectList";

const formatBillingDate = (value: string | null) => {
  if (!value) return null;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatCadence = (cadence: Entitlement["cadence"]) => {
  if (!cadence) return "No paid plan";
  return `${cadence[0].toUpperCase()}${cadence.slice(1)} plan`;
};

const getPortalErrorMessage = (error: unknown) => {
  if (error instanceof BillingError) {
    switch (error.code) {
      case "no_active_subscription":
      case "no_customer":
        return "We could not find an active subscription to manage yet. Start a subscription first.";
      case "user_token_required":
      case "Missing bearer token":
        return "Sign in again before managing billing.";
      default:
        return "Billing management is temporarily unavailable. Please try again.";
    }
  }

  return "Billing management is temporarily unavailable. Please try again.";
};

interface ProfileMainViewProps {
  workspace: ProfileWorkspaceState;
}

const ProfileMainView = ({ workspace }: ProfileMainViewProps) => {
  const { user } = useAuthContext();
  const [billingError, setBillingError] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);
  const [isLoadingEntitlement, setIsLoadingEntitlement] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const {
    activeImport,
    activeResume,
    isPendingTransition,
    isSaving,
    profile,
    saveProfile,
    updateProfile,
  } = workspace;

  const status = activeImport
    ? (
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Pending import ready to review
        </span>
      )
    : profile.updatedAt
      ? `Updated ${new Date(profile.updatedAt).toLocaleDateString()}`
      : `Current source: ${formatResumeLabel(activeResume)}`;

  useEffect(() => {
    let isMounted = true;

    const loadEntitlement = async () => {
      if (!user) {
        setEntitlement(FREE_ENTITLEMENT);
        setIsLoadingEntitlement(false);
        return;
      }

      setIsLoadingEntitlement(true);
      setBillingError(null);

      try {
        const nextEntitlement = await getEntitlement(user.id);
        if (isMounted) {
          setEntitlement(nextEntitlement);
        }
      } catch {
        if (isMounted) {
          setEntitlement(FREE_ENTITLEMENT);
          setBillingError("Billing status is temporarily unavailable. Paid access is not assumed.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingEntitlement(false);
        }
      }
    };

    void loadEntitlement();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleManageSubscription = async () => {
    setIsOpeningPortal(true);
    setBillingError(null);

    try {
      const { url } = await createPortalSession();
      window.location.assign(url);
    } catch (error) {
      setBillingError(getPortalErrorMessage(error));
      setIsOpeningPortal(false);
    }
  };

  const periodEnd = formatBillingDate(entitlement.currentPeriodEnd);
  const isPaid = entitlement.tier === "paid";
  const billingStatusCopy = isLoadingEntitlement
    ? "Checking your subscription..."
    : isPaid && entitlement.status === "past_due"
      ? periodEnd
        ? `Payment needs attention. Grace access is available until ${periodEnd}.`
        : "Payment needs attention. Manage billing to keep access."
      : isPaid && entitlement.cancelAtPeriodEnd
        ? periodEnd
          ? `Cancellation scheduled. Paid access lasts until ${periodEnd}.`
          : "Cancellation scheduled. Paid access remains active for the current period."
        : isPaid && periodEnd
          ? `Paid access renews through ${periodEnd}.`
          : entitlement.status === "canceled" && periodEnd
            ? `Your last paid period ended ${periodEnd}.`
            : "Free plan. Upgrade when you want detailed AI coaching.";

  const sections: Record<MainProfileSectionId, ReactNode> = {
    about: (
      <ProfileSectionCard
        title="About"
        description="This is the concise professional summary that anchors the rest of the profile."
        icon={<UserRound className="h-5 w-5 text-primary" />}
      >
        <div className="space-y-2">
          <Label htmlFor="profile-about">About</Label>
          <Textarea
            id="profile-about"
            value={profile.summary}
            onChange={(event) => updateProfile({ ...profile, summary: event.target.value })}
            rows={6}
            placeholder="Summarize the pattern of work, scope, and outcomes you want a recruiter or interviewer to understand first."
          />
        </div>
      </ProfileSectionCard>
    ),
    experience: (
      <ExperienceList
        experiences={profile.experiences}
        onChange={(experiences) => updateProfile({ ...profile, experiences })}
      />
    ),
    education: (
      <ProfileSectionCard
        title="Education"
        description="Keep only the education details that meaningfully support your professional profile."
        icon={<GraduationCap className="h-5 w-5 text-primary" />}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              updateProfile({
                ...profile,
                education: [...profile.education, createEmptyEducation()],
              })
            }
          >
            Add education
          </Button>
        }
      >
        {profile.education.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Add formal education only if it helps this professional profile scan better.
          </div>
        ) : (
          <div className="space-y-3">
            {profile.education.map((item, index) => (
              <div key={item.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1.1fr_1.1fr_0.7fr_auto]">
                <Input
                  value={item.degree}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      education: updateArrayItem(
                        profile.education,
                        index,
                        createEmptyEducation({ ...item, degree: event.target.value }),
                      ),
                    })
                  }
                  placeholder="Degree"
                />
                <Input
                  value={item.institution}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      education: updateArrayItem(
                        profile.education,
                        index,
                        createEmptyEducation({ ...item, institution: event.target.value }),
                      ),
                    })
                  }
                  placeholder="Institution"
                />
                <Input
                  value={item.year}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      education: updateArrayItem(
                        profile.education,
                        index,
                        createEmptyEducation({ ...item, year: event.target.value }),
                      ),
                    })
                  }
                  placeholder="Year"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateProfile({
                      ...profile,
                      education: removeArrayItem(profile.education, index),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>
    ),
    skills: (
      <ProfileSectionCard
        title="Skills"
        description="Use grouped skills for fast scanning instead of long undifferentiated lists."
        icon={<BookOpen className="h-5 w-5 text-primary" />}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              updateProfile({
                ...profile,
                skills: [...profile.skills, createEmptySkillGroup()],
              })
            }
          >
            Add skill group
          </Button>
        }
      >
        {profile.skills.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Add grouped skills such as Product, Technical, Analytics, or Leadership.
          </div>
        ) : (
          <div className="space-y-3">
            {profile.skills.map((group, index) => (
              <div key={group.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_2fr_auto]">
                <Input
                  value={group.name}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      skills: updateArrayItem(
                        profile.skills,
                        index,
                        createEmptySkillGroup({ ...group, name: event.target.value }),
                      ),
                    })
                  }
                  placeholder="Group name"
                />
                <Input
                  value={group.skills.join(", ")}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      skills: updateArrayItem(
                        profile.skills,
                        index,
                        createEmptySkillGroup({
                          ...group,
                          skills: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                        }),
                      ),
                    })
                  }
                  placeholder="Discovery, roadmapping, SQL"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateProfile({
                      ...profile,
                      skills: removeArrayItem(profile.skills, index),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>
    ),
    projects: (
      <ProjectList
        projects={profile.projects}
        onChange={(projects) => updateProfile({ ...profile, projects })}
      />
    ),
    certifications: (
      <ProfileSectionCard
        title="Licenses & certifications"
        description="Only include credentials that strengthen the professional story."
        icon={<Award className="h-5 w-5 text-primary" />}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              updateProfile({
                ...profile,
                certifications: [...profile.certifications, createEmptyCertification()],
              })
            }
          >
            Add credential
          </Button>
        }
      >
        {profile.certifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Add certifications when they materially improve how this profile reads.
          </div>
        ) : (
          <div className="space-y-3">
            {profile.certifications.map((item, index) => (
              <div key={item.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1.4fr_1fr_0.7fr_auto]">
                <Input
                  value={item.name}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      certifications: updateArrayItem(
                        profile.certifications,
                        index,
                        createEmptyCertification({ ...item, name: event.target.value }),
                      ),
                    })
                  }
                  placeholder="Certification"
                />
                <Input
                  value={item.issuer}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      certifications: updateArrayItem(
                        profile.certifications,
                        index,
                        createEmptyCertification({ ...item, issuer: event.target.value }),
                      ),
                    })
                  }
                  placeholder="Issuer"
                />
                <Input
                  value={item.year}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      certifications: updateArrayItem(
                        profile.certifications,
                        index,
                        createEmptyCertification({ ...item, year: event.target.value }),
                      ),
                    })
                  }
                  placeholder="Year"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateProfile({
                      ...profile,
                      certifications: removeArrayItem(profile.certifications, index),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>
    ),
    languages: (
      <ProfileSectionCard
        title="Languages"
        description="Only keep language entries that are relevant to the roles you want."
        icon={<Languages className="h-5 w-5 text-primary" />}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              updateProfile({
                ...profile,
                languages: [...profile.languages, createEmptyLanguage()],
              })
            }
          >
            Add language
          </Button>
        }
      >
        {profile.languages.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Add a language when it matters to your role fit or profile context.
          </div>
        ) : (
          <div className="space-y-3">
            {profile.languages.map((item, index) => (
              <div key={item.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={item.language}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      languages: updateArrayItem(
                        profile.languages,
                        index,
                        createEmptyLanguage({ ...item, language: event.target.value }),
                      ),
                    })
                  }
                  placeholder="Language"
                />
                <Input
                  value={item.proficiency}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      languages: updateArrayItem(
                        profile.languages,
                        index,
                        createEmptyLanguage({ ...item, proficiency: event.target.value }),
                      ),
                    })
                  }
                  placeholder="Fluent"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateProfile({
                      ...profile,
                      languages: removeArrayItem(profile.languages, index),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>
    ),
  };

  return (
    <div className="space-y-6">
      <ProfileHeader
        title="Profile"
        status={status}
        description="Shape the familiar, public-facing version of your professional profile here. Import mechanics and research settings live elsewhere."
        actions={
          <>
            {isPaid || entitlement.status === "past_due" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleManageSubscription()}
                disabled={isOpeningPortal}
              >
                {isOpeningPortal ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Manage subscription
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/pricing?checkout=monthly">Upgrade</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/profile/import">Import CV</Link>
            </Button>
            <Button type="button" onClick={() => void saveProfile()} disabled={isSaving || isPendingTransition}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      />

      {billingError ? (
        <Alert variant="destructive">
          <AlertDescription>{billingError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Subscription</h2>
              <Badge variant={isPaid ? "default" : "secondary"}>
                {isLoadingEntitlement ? "Loading" : isPaid ? "Paid" : "Free"}
              </Badge>
              {entitlement.status === "past_due" ? (
                <Badge variant="destructive">Past due</Badge>
              ) : null}
              {entitlement.cancelAtPeriodEnd ? (
                <Badge variant="outline">Cancels at period end</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">{billingStatusCopy}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span>
                <span className="text-muted-foreground">Plan:</span>{" "}
                <span className="font-medium">{formatCadence(entitlement.cadence)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Period end:</span>{" "}
                <span className="font-medium">{periodEnd ?? "Not applicable"}</span>
              </span>
            </div>
          </div>
          {isPaid || entitlement.status === "past_due" ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void handleManageSubscription()}
              disabled={isOpeningPortal}
            >
              {isOpeningPortal ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Manage billing
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-auto">
              <Link to="/pricing?checkout=monthly">Upgrade</Link>
            </Button>
          )}
        </div>
      </div>

      <ProfileSummaryCard
        activeImportCreatedAt={activeImport?.createdAt ?? null}
        activeResume={activeResume}
        profile={profile}
        updateProfile={updateProfile}
      />

      <div className="space-y-6">
        {PROFILE_MAIN_SECTION_ORDER.map((section) => (
          <div key={section} id={section === "experience" ? "profile-experience" : undefined}>
            {sections[section]}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileMainView;
