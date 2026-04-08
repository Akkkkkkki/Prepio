import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Upload, Search, FileText, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { searchService } from "@/services/searchService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import ProgressDialog from "@/components/ProgressDialog";
import { ACCEPTED_RESUME_TYPES, ResumeUploadError, buildResumeStoragePath, extractResumeText } from "@/lib/resumeUpload";

type SeniorityLevel = 'junior' | 'mid' | 'senior';

const HOME_CV_UPLOAD_ID = "home-cv-upload";

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    company: "",
    role: "",
    country: "",
    cv: "",
    roleLinks: "",
    targetSeniority: "auto" as SeniorityLevel | "auto" | undefined
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [profileResume, setProfileResume] = useState<{ content: string; created_at?: string } | null>(null);
  const [isLoadingProfileResume, setIsLoadingProfileResume] = useState(false);
  const [isUsingProfileResume, setIsUsingProfileResume] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);

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
            created_at: result.resume.created_at
          });

          setFormData(prev => {
            if (prev.cv.trim().length > 0) return prev;
            return { ...prev, cv: result.resume?.content || "" };
          });
          setIsUsingProfileResume(true);
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

    loadProfileResume();

    return () => {
      isMounted = false;
    };
  }, [user, setFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company.trim()) return;
    
    if (!user) {
      setError("Please sign in to continue");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Step 1: Create search record and show progress dialog immediately
      const result = await searchService.createSearchRecord({
        company: formData.company.trim(),
        role: formData.role.trim() || undefined,
        country: formData.country.trim() || undefined,
        roleLinks: formData.roleLinks.trim() || undefined,
        cv: formData.cv.trim() || undefined,
        targetSeniority: formData.targetSeniority === 'auto' ? undefined : formData.targetSeniority
      });

      if (result.success && result.searchId) {
        // Immediately show progress dialog
        setCurrentSearchId(result.searchId);
        setShowProgressDialog(true);
        setIsLoading(false); // Stop the button loading state
        
        // Show success toast notification
        toast({
          title: "Research Started!",
          description: "Your AI research is now running. Track progress in the dialog or check back in a few minutes.",
          duration: 3000,
        });
        
        // Step 2: Start the actual processing asynchronously
        searchService.startProcessing(result.searchId, {
          company: formData.company.trim(),
          role: formData.role.trim() || undefined,
          country: formData.country.trim() || undefined,
          roleLinks: formData.roleLinks.trim() || undefined,
          cv: formData.cv.trim() || undefined,
          targetSeniority: formData.targetSeniority === 'auto' ? undefined : formData.targetSeniority
        });
        
      } else {
        const errorMessage = result.error?.message || "Failed to create search. Please try again.";
        setError(errorMessage);
        toast({
          title: "Error Starting Research",
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        });
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error submitting search:", err);
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

    if (!file) {
      return;
    }

    setError(null);
    setIsUploadingResume(true);

    try {
      const { text } = await extractResumeText(file);
      let parsedData: Record<string, unknown> | undefined;
      let analysisUnavailable = false;

      setFormData((prev) => ({ ...prev, cv: text }));
      setIsUsingProfileResume(false);

      if (!user) {
        toast({
          title: "Resume parsed locally",
          description: "Sign in to save the uploaded resume file to your profile.",
          duration: 4000,
        });
        return;
      }

      const analysisResult = await searchService.analyzeCV(text);
      if (analysisResult.success) {
        parsedData = analysisResult.parsedData;
      } else {
        analysisUnavailable = true;
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
      setIsUsingProfileResume(true);

      toast({
        title: analysisUnavailable ? "Resume uploaded with limited analysis" : "Resume uploaded",
        description: analysisUnavailable
          ? "We saved the extracted text and file, but structured profile fields were not refreshed because CV analysis is unavailable right now."
          : "We saved your resume file, extracted the text, and updated your profile resume.",
        duration: 4000,
      });
    } catch (uploadError) {
      console.error("Error uploading resume:", uploadError);
      const message = uploadError instanceof ResumeUploadError
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
    setFormData(prev => ({ ...prev, cv: profileResume.content }));
    setIsUsingProfileResume(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Always show Navigation for logged-in users */}
      {user && <Navigation />}
      
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            <span className="text-primary">Prepio</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Get insider insights on any company's interview process. Tailored prep for you and your friends.
          </p>
          
          {/* Simple login/signup buttons for non-logged-in users */}
          {!user && (
            <div className="flex gap-4 justify-center mb-8">
              <Button onClick={() => navigate("/auth")}>
                Sign Up
              </Button>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            </div>
          )}
        </div>

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
                  Sign in before starting research so your results, practice sessions, and saved resume stay attached to your account.
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  placeholder="e.g., Google, Microsoft, Stripe..."
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role (optional)</Label>
                  <Input
                    id="role"
                    placeholder="e.g., Software Engineer"
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country (optional)</Label>
                  <Input
                    id="country"
                    placeholder="e.g., United States"
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetSeniority">Target Level (optional)</Label>
                  <Select
                    value={formData.targetSeniority}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      targetSeniority: (value === 'auto' ? undefined : value as SeniorityLevel)
                    }))}
                  >
                    <SelectTrigger id="targetSeniority">
                      <SelectValue placeholder="Auto-detect from CV" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        <span className="text-muted-foreground">Auto-detect from CV</span>
                      </SelectItem>
                      <SelectItem value="junior">🌱 Junior (0-2 years)</SelectItem>
                      <SelectItem value="mid">🚀 Mid-level (3-7 years)</SelectItem>
                      <SelectItem value="senior">⭐ Senior (8+ years)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Accordion type="multiple" defaultValue={["resume"]} className="space-y-3">
                <AccordionItem value="resume" className="rounded-2xl border px-4">
                  <AccordionTrigger className="py-4 text-left hover:no-underline">
                    Add your resume and background
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-4">
                    <div className="space-y-4">
                      <Label>CV / Resume</Label>
                      {isLoadingProfileResume && (
                        <p className="text-xs text-muted-foreground">Loading your saved resume...</p>
                      )}
                      {!isLoadingProfileResume && profileResume && (
                        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              {isUsingProfileResume
                                ? "Using resume saved on your Profile."
                                : "You have a saved resume on your Profile. Edit it there to update defaults."}
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
                            >
                              Manage Profile Resume
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleRestoreProfileResume}
                              disabled={isUsingProfileResume}
                            >
                              Restore Saved CV
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="rounded-lg border-2 border-dashed border-border p-6">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <div className="text-center">
                            <p className="mb-2 text-sm text-muted-foreground">
                              Upload a PDF or DOCX, or paste your CV text below. Signed-in uploads also update the resume saved on your profile.
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
                        onChange={(e) => {
                          const updatedValue = e.target.value;
                          setFormData(prev => ({ ...prev, cv: updatedValue }));
                          if (profileResume?.content) {
                            setIsUsingProfileResume(updatedValue.trim() === profileResume.content.trim());
                          } else {
                            setIsUsingProfileResume(false);
                          }
                        }}
                        rows={6}
                        className="resize-none"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="job-links" className="rounded-2xl border px-4">
                  <AccordionTrigger className="py-4 text-left hover:no-underline">
                    Add role description links
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pb-4">
                    <Label htmlFor="role-links">Role description links</Label>
                    <Textarea
                      id="role-links"
                      placeholder="Paste job description links here, one per line..."
                      value={formData.roleLinks}
                      onChange={(e) => setFormData(prev => ({ ...prev, roleLinks: e.target.value }))}
                      rows={3}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Add links to job descriptions to improve research accuracy.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button
                type={user ? "submit" : "button"}
                className="w-full"
                size="lg"
                disabled={!formData.company.trim() || isLoading || isUploadingResume}
                onClick={
                  user
                    ? undefined
                    : () => navigate("/auth", { state: { from: { pathname: "/" } } })
                }
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
      </div>
      
      {/* Progress Dialog */}
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
