import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Search,
  Upload,
} from "lucide-react";

import Navigation from "@/components/Navigation";
import ProgressDialog from "@/components/ProgressDialog";
import PublicHeader from "@/components/PublicHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  clearResearchDraft,
  createAuthReturnState,
  loadResearchDraft,
  RESEARCH_DRAFT_STORAGE_KEY,
  type ResearchDraft,
  type ResearchStep,
  saveResearchDraft,
  type SeniorityLevel,
  type Level,
} from "@/lib/researchDraft";
import { ACCEPTED_RESUME_TYPES, ResumeUploadError, buildResumeStoragePath, extractResumeText } from "@/lib/resumeUpload";
import { cn } from "@/lib/utils";
import { searchService } from "@/services/searchService";
import { useToast } from "@/hooks/use-toast";

type FormLevel = Level | "auto" | undefined;

type ResearchFormData = {
  company: string;
  role: string;
  country: string;
  cv: string;
  roleLinks: string;
  userNote: string;
  jobDescription: string;
  level: FormLevel;
  /** @deprecated kept for draft compat */
  targetSeniority?: SeniorityLevel | "auto";
};

const HOME_CV_UPLOAD_ID = "home-cv-upload";
const MOBILE_STEP_ORDER: ResearchStep[] = ["company", "details", "tailoring"];
const GUEST_RESEARCH_RESUME_STEP: ResearchStep = "details";
const SUGGESTED_COMPANIES = ["Google", "Meta", "Amazon", "Stripe", "OpenAI", "Palantir"];
const DEFAULT_FORM_DATA: ResearchFormData = {
  company: "",
  role: "",
  country: "",
  cv: "",
  roleLinks: "",
  userNote: "",
  jobDescription: "",
  level: "auto",
};

const MOBILE_STEP_COPY: Record<
  ResearchStep,
  { eyebrow: string; title: string; description: string }
> = {
  company: {
    eyebrow: "Step 1 of 3",
    title: "Start with the company",
    description: "You only need one field to get moving.",
  },
  details: {
    eyebrow: "Step 2 of 3",
    title: "Add optional details",
    description: "Role, country, and level help tune the research depth.",
  },
  tailoring: {
    eyebrow: "Step 3 of 3",
    title: "Tailor the prep",
    description: "Add your CV or job links when you want sharper practice.",
  },
};

const getNextStep = (step: ResearchStep) => {
  const currentIndex = MOBILE_STEP_ORDER.indexOf(step);
  return MOBILE_STEP_ORDER[Math.min(currentIndex + 1, MOBILE_STEP_ORDER.length - 1)];
};

const getPreviousStep = (step: ResearchStep) => {
  const currentIndex = MOBILE_STEP_ORDER.indexOf(step);
  return MOBILE_STEP_ORDER[Math.max(currentIndex - 1, 0)];
};

const buildSearchPayload = (formData: ResearchFormData) => ({
  company: formData.company.trim(),
  role: formData.role.trim() || undefined,
  country: formData.country.trim() || undefined,
  roleLinks: formData.roleLinks.trim() || undefined,
  cv: formData.cv.trim() || undefined,
  level: formData.level === "auto" ? undefined : formData.level,
  userNote: formData.userNote?.trim() || undefined,
  jobDescription: formData.jobDescription?.trim() || undefined,
});

const GUEST_HOME_STEPS = [
  {
    title: "Share the company",
    description: "Start with the employer and add the role if you already know the opening.",
  },
  {
    title: "Unlock the full brief",
    description: "Create an account or sign in. We keep your draft and send you straight back.",
  },
  {
    title: "Practice from the research",
    description: "Turn the brief into tailored mock questions, notes, and follow-up actions.",
  },
] as const;

const GUEST_SAMPLE_STAGES = [
  {
    title: "Recruiter screen",
    detail: "Motivation, timeline, and high-level fit.",
  },
  {
    title: "Hiring manager",
    detail: "Execution stories, tradeoffs, and role scope.",
  },
  {
    title: "Panel loop",
    detail: "Technical depth, collaboration, and decision quality.",
  },
] as const;

const GUEST_SAMPLE_SIGNALS = [
  "Expected stage order and likely question themes",
  "Company-specific prep notes to focus your practice",
  "A short list of follow-up drills after each session",
] as const;

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { canInstall, promptInstall } = useInstallPrompt();
  const isMobile = useIsMobile();
  const { isOnline, isOffline } = useNetworkStatus();

  const [formData, setFormData] = useState<ResearchFormData>(DEFAULT_FORM_DATA);
  const [mobileStep, setMobileStep] = useState<ResearchStep>("company");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<"pending" | "processing" | "completed" | "failed">("pending");
  const [profileResume, setProfileResume] = useState<{ content: string; created_at?: string } | null>(null);
  const [isLoadingProfileResume, setIsLoadingProfileResume] = useState(false);
  const [isUsingProfileResume, setIsUsingProfileResume] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);

  useEffect(() => {
    const draft = loadResearchDraft();
    if (!draft) return;

    setFormData({
      company: draft.company,
      role: draft.role,
      country: draft.country,
      cv: draft.cv,
      roleLinks: draft.roleLinks,
      userNote: draft.userNote || "",
      jobDescription: draft.jobDescription || "",
      level: draft.level ?? "auto",
    });
    setMobileStep(draft.step);
  }, []);

  useEffect(() => {
    if (!profileResume?.content) {
      if (!formData.cv.trim()) {
        setIsUsingProfileResume(false);
      }
      return;
    }

    setIsUsingProfileResume(formData.cv.trim() === profileResume.content.trim());
  }, [formData.cv, profileResume?.content]);

  useEffect(() => {
    let isMounted = true;

    const loadProfileResume = async () => {
      if (!user) {
        setProfileResume(null);
        setIsUsingProfileResume(false);
        return;
      }

      setIsLoadingProfileResume(true);
      try {
        const result = await searchService.getResume(user.id);
        if (!isMounted) return;

        if (result.success && result.resume?.content) {
          setProfileResume({
            content: result.resume.content,
            created_at: result.resume.created_at,
          });

          setFormData((prev) => {
            if (prev.cv.trim().length > 0) return prev;
            return { ...prev, cv: result.resume?.content || "" };
          });
        } else {
          setProfileResume(null);
        }
      } catch (resumeError) {
        console.error("Error loading saved resume:", resumeError);
        if (isMounted) {
          setProfileResume(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfileResume(false);
        }
      }
    };

    void loadProfileResume();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const persistDraft = (step: ResearchStep) => {
    const draft: ResearchDraft = {
      company: formData.company,
      role: formData.role,
      country: formData.country,
      level: formData.level === "auto" ? undefined : formData.level,
      userNote: formData.userNote || "",
      jobDescription: formData.jobDescription || "",
      cv: formData.cv,
      roleLinks: formData.roleLinks,
      step,
      savedAt: new Date().toISOString(),
    };

    saveResearchDraft(draft);
  };

  const navigateToAuth = (step: ResearchStep) => {
    persistDraft(step);
    navigate("/auth", {
      state: createAuthReturnState({
        pathname: "/",
        draftStorageKey: RESEARCH_DRAFT_STORAGE_KEY,
        intent: "research",
        source: "research_home",
      }),
    });
  };

  const startStatusPolling = (searchId: string) => {
    let pollCount = 0;
    let hasShownTimeoutWarning = false;
    let latestStatus: "pending" | "processing" | "completed" | "failed" = "pending";

    const poll = async () => {
      try {
        const status = await searchService.getSearchStatus(searchId);
        if (status) {
          const newStatus = status.status as "pending" | "processing" | "completed" | "failed";
          latestStatus = newStatus;
          setSearchStatus(newStatus);

          if (newStatus === "completed" || newStatus === "failed") {
            if (newStatus === "failed") {
              toast({
                title: "Research Failed",
                description: "The research process encountered an error. Please try again.",
                variant: "destructive",
                duration: 5000,
              });
            }
            return false;
          }
        }

        if (pollCount > 75 && !hasShownTimeoutWarning) {
          hasShownTimeoutWarning = true;
          toast({
            title: "Research Taking Longer",
            description: "The research is taking longer than expected. You can leave this screen and check progress later.",
            duration: 8000,
          });
        }

        pollCount++;
        return true;
      } catch (pollError) {
        console.error("Error polling search status:", pollError);
        pollCount++;
        return true;
      }
    };

    void poll().then((shouldContinue) => {
      if (!shouldContinue) return;

      const pollInterval = setInterval(async () => {
        const shouldContinuePolling = await poll();
        if (!shouldContinuePolling) {
          clearInterval(pollInterval);
          return;
        }

        if (pollCount > 40) {
          clearInterval(pollInterval);

          const slowPollInterval = setInterval(async () => {
            const shouldContinueSlowPolling = await poll();
            if (!shouldContinueSlowPolling) {
              clearInterval(slowPollInterval);
            }
          }, 5000);

          setTimeout(() => {
            clearInterval(slowPollInterval);
            if (latestStatus === "processing" || latestStatus === "pending") {
              setSearchStatus("failed");
              toast({
                title: "Research Timeout",
                description: "The research process has timed out. Please try again with a smaller scope.",
                variant: "destructive",
                duration: 10000,
              });
            }
          }, 360000);
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(pollInterval);
      }, 120000);
    });
  };

  const submitResearch = async () => {
    if (!formData.company.trim()) return;

    if (!isOnline) {
      setError("Reconnect to start research. You can keep editing the draft while offline.");
      return;
    }

    if (!user) {
      navigateToAuth(isMobile ? mobileStep : "tailoring");
      return;
    }

    setIsLoading(true);
    setError(null);

    const searchPayload = buildSearchPayload(formData);

    try {
      const result = await searchService.createSearchRecord(searchPayload);

      if (result.success && result.searchId) {
        clearResearchDraft();
        setCurrentSearchId(result.searchId);
        setSearchStatus("pending");
        setShowProgressDialog(true);
        setIsLoading(false);
        const processResult = await searchService.startProcessing(result.searchId, searchPayload);

        if (!processResult.success) {
          const errorMessage =
            processResult.error instanceof Error
              ? processResult.error.message
              : "We couldn't start the research pipeline. Please try again.";
          setSearchStatus("failed");
          setError(errorMessage);
          toast({
            title: "Error Starting Research",
            description: errorMessage,
            variant: "destructive",
            duration: 5000,
          });
          return;
        }

        toast({
          title: "Research Started!",
          description: "Your research is queued. You can leave this screen and keep an eye on progress from the dashboard.",
          duration: 3000,
        });

        startStatusPolling(result.searchId);
        return;
      }

      const errorMessage = result.error?.message || "Failed to create search. Please try again.";
      setError(errorMessage);
      toast({
        title: "Error Starting Research",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
      setIsLoading(false);
    } catch (submitError) {
      console.error("Error submitting search:", submitError);
      const errorMessage = "An unexpected error occurred. Please try again.";
      setError(errorMessage);
      toast({
        title: "Error Starting Research",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitResearch();
  };

  const handleCloseProgressDialog = () => {
    setShowProgressDialog(false);
  };

  const handleViewResults = () => {
    if (currentSearchId) {
      navigate(`/search/${currentSearchId}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    setError(null);
    setIsUploadingResume(true);

    try {
      const { text } = await extractResumeText(file);
      let parsedData: Record<string, unknown> | undefined;

      setFormData((prev) => ({ ...prev, cv: text }));

      if (!user) {
        toast({
          title: "Resume parsed locally",
          description: "We kept the text in your draft. Sign in later if you want it saved to your profile too.",
          duration: 4000,
        });
        return;
      }

      if (!isOnline) {
        toast({
          title: "Resume parsed locally",
          description:
            "We updated the draft text, but reconnect before you sync this resume to your profile.",
          duration: 4000,
        });
        return;
      }

      const analysisResult = await searchService.analyzeCV(text);
      if (analysisResult.success) {
        parsedData = analysisResult.parsedData;
      } else {
        console.warn(
          "CV analysis unavailable during resume upload. Saving extracted text without parsed profile data.",
          analysisResult.error,
        );
      }

      const storagePath = buildResumeStoragePath(user.id, file.name);
      const uploadResult = await searchService.uploadResumeFile(file, storagePath);
      if (!uploadResult.success || !uploadResult.path) {
        throw new Error(uploadResult.error?.message || "Failed to upload the resume file");
      }

      const saveResult = await searchService.saveResume({
        content: text,
        parsedData,
        file: {
          name: file.name,
          path: uploadResult.path,
          size: file.size,
          mimeType: file.type,
        },
        source: "upload",
      });

      if (!saveResult.success) {
        await searchService.deleteResumeFiles([uploadResult.path]);
        throw new Error(saveResult.error?.message || "Failed to save the uploaded resume");
      }

      setProfileResume({
        content: text,
        created_at: saveResult.resume?.created_at,
      });

      const candidateProfileResult = await searchService.getCandidateProfile();
      const importResult = await searchService.createProfileImport({
        resumeText: text,
        resumeId: saveResult.resume?.id,
        source: "upload",
        existingProfile:
          candidateProfileResult.success && candidateProfileResult.profile
            ? candidateProfileResult.profile
            : undefined,
      });

      toast({
        title: importResult.success ? "Resume imported" : "Resume uploaded",
        description: importResult.success
          ? "We saved a new resume version and created a profile merge draft. Review it on your interview profile."
          : parsedData
            ? "We saved a new resume version. The merge draft is unavailable right now, but your interview profile can still bootstrap from the saved parse."
            : "We saved a new resume version, but the structured profile merge draft is unavailable right now.",
        duration: 4000,
      });
    } catch (uploadError) {
      console.error("Error uploading resume:", uploadError);
      const message =
        uploadError instanceof ResumeUploadError
          ? uploadError.message
          : uploadError instanceof Error
            ? uploadError.message
            : "Failed to process that resume file.";

      setError(message);
      toast({
        title: "Resume upload failed",
        description: message,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleRestoreProfileResume = () => {
    if (!profileResume?.content) return;
    setFormData((prev) => ({ ...prev, cv: profileResume.content }));
  };

  const handleMobilePrimaryAction = () => {
    if (mobileStep !== "tailoring") {
      setMobileStep(getNextStep(mobileStep));
      return;
    }

    void submitResearch();
  };

  const currentStepIndex = MOBILE_STEP_ORDER.indexOf(mobileStep);
  const mobileStepCopy = MOBILE_STEP_COPY[mobileStep];
  const mobilePrimaryLabel =
    mobileStep === "tailoring"
      ? user
        ? isLoading
          ? "Researching..."
          : "Start research"
        : "Sign in to start research"
      : "Next";
  const mobilePrimaryDisabled =
    isUploadingResume ||
    isLoading ||
    (!isOnline && mobileStep === "tailoring") ||
    (mobileStep === "company" && !formData.company.trim());
  const mobileFooterPadding = "calc(1rem + env(safe-area-inset-bottom))";

  const renderProfileResumeNote = (buttonClassName?: string) => (
    <>
      {isLoadingProfileResume && (
        <p className="text-xs text-muted-foreground">Loading your interview profile source...</p>
      )}

      {!isLoadingProfileResume && profileResume && (
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {isUsingProfileResume
                ? "Using the active resume version from your interview profile."
                : "You already have an active resume version on your interview profile."}
            </span>
            {profileResume.created_at && (
              <span className="text-[11px] text-muted-foreground/80">
                Last updated {new Date(profileResume.created_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate("/profile")}
              className={buttonClassName}
            >
              Open interview profile
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRestoreProfileResume}
              disabled={isUsingProfileResume}
              className={buttonClassName}
            >
              Restore saved CV
            </Button>
          </div>
        </div>
      )}
    </>
  );

  const renderMobileStepContent = () => {
    switch (mobileStep) {
      case "company":
        return (
          <section className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {mobileStepCopy.eyebrow}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">{mobileStepCopy.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{mobileStepCopy.description}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-mobile">Company *</Label>
              <Input
                id="company-mobile"
                placeholder="e.g. Google, Microsoft, Stripe"
                value={formData.company}
                onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
                className="h-12 rounded-2xl text-base"
                autoComplete="organization"
                required
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Suggested companies
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_COMPANIES.map((company) => (
                  <Button
                    key={company}
                    type="button"
                    variant={formData.company === company ? "default" : "outline"}
                    onClick={() => setFormData((prev) => ({ ...prev, company }))}
                    className="h-11 rounded-full px-4 text-sm"
                  >
                    {company}
                  </Button>
                ))}
              </div>
            </div>
          </section>
        );

      case "details":
        return (
          <section className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {mobileStepCopy.eyebrow}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">{mobileStepCopy.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{mobileStepCopy.description}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role-mobile">Role</Label>
                <Input
                  id="role-mobile"
                  placeholder="e.g. Software Engineer"
                  value={formData.role}
                  onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                  className="h-12 rounded-2xl text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country-mobile">Country</Label>
                <Input
                  id="country-mobile"
                  placeholder="e.g. United States"
                  value={formData.country}
                  onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                  className="h-12 rounded-2xl text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="level-mobile">Level</Label>
                <Select
                  value={formData.level}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      level: value === "auto" ? "auto" : (value as Level),
                    }))
                  }
                >
                  <SelectTrigger id="level-mobile" className="h-12 rounded-2xl text-base">
                    <SelectValue placeholder="Auto-detect from CV" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect from CV</SelectItem>
                    <SelectItem value="junior">Junior (0-2 years)</SelectItem>
                    <SelectItem value="mid">Mid-level (3-7 years)</SelectItem>
                    <SelectItem value="senior_ic">Senior IC (8+ years)</SelectItem>
                    <SelectItem value="people_manager">People Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-[24px] border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
              Everything on this step is optional. Skip it if you want broad company prep first.
            </div>
          </section>
        );

      case "tailoring":
        return (
          <section className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {mobileStepCopy.eyebrow}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">{mobileStepCopy.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{mobileStepCopy.description}</p>
            </div>

            <Accordion
              key={`${formData.cv.trim().length > 0}-${formData.roleLinks.trim().length > 0}`}
              type="multiple"
              defaultValue={[
                "resume",
                ...(formData.roleLinks.trim().length > 0 ? ["role-links"] : []),
              ]}
              className="space-y-3"
            >
              <AccordionItem value="resume" className="rounded-[24px] border bg-muted/20 px-4">
                <AccordionTrigger className="py-4 text-left text-sm hover:no-underline">
                  <div>
                    <p className="font-medium text-foreground">CV / Resume</p>
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      Import a source resume, then keep a richer interview profile.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  {renderProfileResumeNote("h-10")}

                  <div className="rounded-[24px] border-2 border-dashed border-border bg-background p-5">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <div className="space-y-2">
                        <p className="text-sm leading-6 text-muted-foreground">
                          Upload a PDF or DOCX, or paste your CV below. Signed-in uploads create a new resume version and a profile merge draft.
                        </p>
                        <input
                          type="file"
                          accept={ACCEPTED_RESUME_TYPES}
                          onChange={handleFileUpload}
                          className="hidden"
                          id={HOME_CV_UPLOAD_ID}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(HOME_CV_UPLOAD_ID)?.click()}
                          disabled={isUploadingResume}
                          className="h-11 rounded-full px-4"
                        >
                          {isUploadingResume ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          {isUploadingResume ? "Processing..." : "Upload PDF / DOCX"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Textarea
                    placeholder="Or paste your CV text here..."
                    value={formData.cv}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cv: e.target.value }))}
                    rows={7}
                    className="min-h-[180px] resize-none rounded-[24px] border bg-background p-4 text-base"
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="role-links" className="rounded-[24px] border bg-muted/20 px-4">
                <AccordionTrigger className="py-4 text-left text-sm hover:no-underline">
                  <div>
                    <p className="font-medium text-foreground">Job link or description</p>
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      Add job links or paste the job description to match a specific opening.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <Textarea
                    id="role-links-mobile"
                    placeholder="Paste job description links here (one per line)..."
                    value={formData.roleLinks}
                    onChange={(e) => setFormData((prev) => ({ ...prev, roleLinks: e.target.value }))}
                    rows={3}
                    className="min-h-[100px] resize-none rounded-[24px] border bg-background p-4 text-base"
                  />
                  <Textarea
                    id="job-description-mobile"
                    placeholder="Or paste the full job description here..."
                    value={formData.jobDescription}
                    onChange={(e) => setFormData((prev) => ({ ...prev, jobDescription: e.target.value }))}
                    rows={4}
                    className="min-h-[140px] resize-none rounded-[24px] border bg-background p-4 text-base"
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="user-note" className="rounded-[24px] border bg-muted/20 px-4">
                <AccordionTrigger className="py-4 text-left text-sm hover:no-underline">
                  <div>
                    <p className="font-medium text-foreground">Notes for the research</p>
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      Share anything that helps — known stages, interviewers, format, deadline.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <Textarea
                    id="user-note-mobile"
                    placeholder={"e.g. I spoke with the recruiter — they mentioned a system design round and a bar raiser.\nInterview is next Thursday.\nI'd like more focus on behavioral questions."}
                    value={formData.userNote}
                    onChange={(e) => setFormData((prev) => ({ ...prev, userNote: e.target.value }))}
                    rows={5}
                    className="min-h-[160px] resize-none rounded-[24px] border bg-background p-4 text-base"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        );
    }
  };

  const renderDesktopForm = () => (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Start Your Interview Research
        </CardTitle>
        <CardDescription>
          Enter company details to get personalized interview insights and preparation guidance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!user && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Sign in before starting research so your results, practice sessions, interview profile, and resume versions stay attached to your account.
            </AlertDescription>
          </Alert>
        )}
        {isOffline && (
            <Alert className="mb-6 border-amber-300 bg-amber-50 text-amber-950">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You&apos;re offline. Reconnect before you start research. Resume files still parse
                locally, but profile sync waits until you&apos;re back online.
              </AlertDescription>
            </Alert>
          )}

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company">Company *</Label>
            <Input
              id="company"
              placeholder="e.g., Google, Microsoft, Stripe..."
              value={formData.company}
              onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="role">Role (optional)</Label>
              <Input
                id="role"
                placeholder="e.g., Software Engineer"
                value={formData.role}
                onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country (optional)</Label>
              <Input
                id="country"
                placeholder="e.g., United States"
                value={formData.country}
                onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Level (optional)</Label>
              <Select
                value={formData.level}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    level: value === "auto" ? "auto" : (value as Level),
                  }))
                }
              >
                <SelectTrigger id="level">
                  <SelectValue placeholder="Auto-detect from CV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect from CV</SelectItem>
                  <SelectItem value="junior">Junior (0-2 years)</SelectItem>
                  <SelectItem value="mid">Mid-level (3-7 years)</SelectItem>
                  <SelectItem value="senior_ic">Senior IC (8+ years)</SelectItem>
                  <SelectItem value="people_manager">People Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Label>CV / Resume</Label>
            {renderProfileResumeNote()}

            <div className="rounded-lg border-2 border-dashed border-border p-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="mb-2 text-sm text-muted-foreground">
                    Upload a PDF or DOCX, or paste your CV text below. Signed-in uploads create a resume version and a profile merge draft.
                  </p>
                  <input
                    type="file"
                    accept={ACCEPTED_RESUME_TYPES}
                    onChange={handleFileUpload}
                    className="hidden"
                    id={HOME_CV_UPLOAD_ID}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById(HOME_CV_UPLOAD_ID)?.click()}
                    disabled={isUploadingResume}
                  >
                    {isUploadingResume ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    {isUploadingResume ? "Processing..." : "Upload PDF / DOCX"}
                  </Button>
                </div>
              </div>
            </div>

            <Textarea
              placeholder="Or paste your CV text here..."
              value={formData.cv}
              onChange={(e) => setFormData((prev) => ({ ...prev, cv: e.target.value }))}
              rows={6}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-links">Role Description Links (optional)</Label>
            <Textarea
              id="role-links"
              placeholder="Paste job description links here (one per line)..."
              value={formData.roleLinks}
              onChange={(e) => setFormData((prev) => ({ ...prev, roleLinks: e.target.value }))}
              rows={2}
              className="resize-none"
            />
            <Textarea
              id="job-description"
              placeholder="Or paste the full job description here..."
              value={formData.jobDescription}
              onChange={(e) => setFormData((prev) => ({ ...prev, jobDescription: e.target.value }))}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-note">Notes (optional)</Label>
            <Textarea
              id="user-note"
              placeholder={"Known stages, interviewers, format, deadline, or where you want more focus..."}
              value={formData.userNote}
              onChange={(e) => setFormData((prev) => ({ ...prev, userNote: e.target.value }))}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Share anything from recruiter calls, known interview stages, or areas you want to focus on.
            </p>
          </div>

          <Button
            type={user ? "submit" : "button"}
            className="w-full"
            size="lg"
            disabled={!formData.company.trim() || isLoading || isUploadingResume || isOffline}
            onClick={user ? undefined : () => navigateToAuth("tailoring")}
          >
            {isLoading
              ? "Researching..."
              : user
                ? "Start Research"
                : "Sign In to Start Research"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderGuestHome = () => (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="border shadow-sm">
          <CardHeader className="space-y-4">
            <div className="w-fit rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Research preview
            </div>
            <div className="space-y-3">
              <CardTitle className="text-3xl leading-tight tracking-tight">
                See the interview brief before you create an account.
              </CardTitle>
              <CardDescription className="text-base leading-7">
                Enter the company and role, then finish auth. We keep the draft and reopen the
                full research flow with your context intact.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigateToAuth(GUEST_RESEARCH_RESUME_STEP);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="guest-company">Company *</Label>
                <Input
                  id="guest-company"
                  placeholder="e.g. Stripe, OpenAI, Ramp"
                  value={formData.company}
                  onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
                  autoComplete="organization"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest-role">Role (optional)</Label>
                <Input
                  id="guest-role"
                  placeholder="e.g. Product Manager"
                  value={formData.role}
                  onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                  autoComplete="organization-title"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={!formData.company.trim()}
              >
                Continue to sign in
              </Button>
            </form>

            <Alert className="border-primary/20 bg-primary/5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                We save this draft before auth and reopen the full research form when you return.
              </AlertDescription>
            </Alert>
            {canInstall && (
              <Button type="button" variant="outline" className="w-full" onClick={() => void promptInstall()}>
                Install app
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-muted/20 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="w-fit rounded-full border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Sample output
            </div>
            <CardTitle className="text-2xl tracking-tight">What the first brief looks like</CardTitle>
            <CardDescription className="text-sm leading-6">
              A preview of the research package you unlock after sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {GUEST_SAMPLE_STAGES.map((stage) => (
                <div key={stage.title} className="rounded-2xl border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Stage
                  </p>
                  <p className="mt-2 text-base font-semibold">{stage.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.detail}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[28px] border bg-background p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Search className="h-4 w-4 text-primary" />
                Sample prep highlights
              </div>
              <div className="mt-4 space-y-3">
                {GUEST_SAMPLE_SIGNALS.map((signal) => (
                  <div key={signal} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <p className="text-sm leading-6 text-muted-foreground">{signal}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="rounded-[32px] border bg-card p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Keep the first touch light, then drop into the full signed-in workflow once auth is
            done.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {GUEST_HOME_STEPS.map((step, index) => (
            <div key={step.title} className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                0{index + 1}
              </p>
              <p className="mt-3 text-base font-semibold">{step.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const signedInContainerClassName = cn("container mx-auto px-4", isMobile ? "pb-32 pt-8" : "py-16");

  return (
    <div id="main-content" className="min-h-screen bg-background">
      {user ? (
        <Navigation />
      ) : (
        <PublicHeader
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigateToAuth(GUEST_RESEARCH_RESUME_STEP)}
            >
              Sign in or create account
            </Button>
          }
        />
      )}

      <div className={user ? signedInContainerClassName : "container mx-auto px-4 py-8 md:py-12"}>
        {!user ? renderGuestHome() : isMobile ? (
          <div className="mx-auto max-w-md space-y-6">
            <div className="space-y-4">
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tight">
                  <span className="text-primary">Prepio</span>
                </h1>
                <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                  Move from company research to practice in three short steps, without the
                  desktop-style sprawl.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-[24px] border bg-muted/20 p-2">
                {MOBILE_STEP_ORDER.map((step, index) => {
                  const isComplete = index < currentStepIndex;
                  const isCurrent = step === mobileStep;

                  return (
                    <div
                      key={step}
                      className={cn(
                        "rounded-2xl px-3 py-3 text-center transition-colors",
                        isCurrent ? "bg-background shadow-sm" : "bg-transparent",
                      )}
                    >
                      <div
                        className={cn(
                          "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                          isCurrent || isComplete
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground",
                        )}
                      >
                        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </div>
                      <p
                        className={cn(
                          "mt-2 text-[11px] font-medium uppercase tracking-[0.16em]",
                          isCurrent ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {step === "company" ? "Company" : step === "details" ? "Role Details" : "Personalize"}
                      </p>
                    </div>
                  );
                })}
              </div>

              {error && (
                <Alert variant="destructive" className="rounded-[24px]">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {isOffline && (
                  <Alert className="rounded-[24px] border-amber-300 bg-amber-50 text-amber-950">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You&apos;re offline. Keep editing, reconnect before you start research, and
                      note that resume files only sync to your profile once you&apos;re back online.
                    </AlertDescription>
                  </Alert>
                )}
            </div>

            <form onSubmit={handleFormSubmit}>
              <Card className="overflow-hidden rounded-[32px] border shadow-sm">
                <CardContent className="p-5">{renderMobileStepContent()}</CardContent>
              </Card>
            </form>

            <div
              className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/85"
              data-mobile-home-footer
            >
              <div className="mx-auto max-w-md space-y-3" style={{ paddingBottom: mobileFooterPadding }}>
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span>{mobileStepCopy.eyebrow}</span>
                  <span>{formData.company.trim() || "Company not set"}</span>
                </div>

                <div className="flex gap-3">
                  {mobileStep !== "company" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMobileStep(getPreviousStep(mobileStep))}
                      className="h-12 flex-1 rounded-2xl"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  )}

                  <Button
                    type="button"
                    onClick={handleMobilePrimaryAction}
                    disabled={mobilePrimaryDisabled}
                    className={cn(
                      "h-12 rounded-2xl",
                      mobileStep === "company" ? "w-full" : "flex-1",
                    )}
                  >
                    {mobilePrimaryLabel}
                    {!isLoading && mobileStep !== "tailoring" && (
                      <ChevronRight className="ml-2 h-4 w-4" />
                    )}
                  </Button>
                </div>
                {mobileStep === "tailoring" && isOffline && (
                  <p className="text-center text-xs text-amber-700">
                    Reconnect to start research. Resume files can still be parsed locally.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-12 text-center">
              <h1 className="mb-4 text-5xl font-bold tracking-tight">
                <span className="text-primary">Prepio</span>
              </h1>
              <p className="mb-8 text-xl text-muted-foreground">
                Get insider insights on any company's interview process. Tailored prep for you and your friends.
              </p>
            </div>

            {renderDesktopForm()}
          </>
        )}
      </div>

      <ProgressDialog
        isOpen={showProgressDialog}
        onClose={handleCloseProgressDialog}
        onViewResults={handleViewResults}
        searchId={currentSearchId}
        company={formData.company}
        role={formData.role}
      />
    </div>
  );
};

export default Home;
