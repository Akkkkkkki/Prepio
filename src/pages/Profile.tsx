import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Upload, 
  Trash2, 
  User, 
  Mail, 

  MapPin,
  Briefcase,
  GraduationCap,
  AlertCircle,
  CheckCircle,
  Loader2,
  Phone,
  Award,
  Globe,
  Code,
  Star,
  Building,
  TrendingUp
} from "lucide-react";
import { searchService } from "@/services/searchService";
import { useAuthContext } from "@/components/AuthProvider";
import { ACCEPTED_RESUME_TYPES, ResumeUploadError, buildResumeStoragePath, extractResumeText } from "@/lib/resumeUpload";

type SeniorityLevel = 'junior' | 'mid' | 'senior';

const PROFILE_CV_UPLOAD_ID = "profile-cv-upload";

interface ParsedData {
  personalInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  professional?: {
    currentRole?: string;
    experience?: string;
    summary?: string;
    workHistory?: Array<{
      title: string;
      company: string;
      duration: string;
      description?: string;
    }>;
  };
  education?: Array<{
    degree: string;
    institution: string;
    year?: string;
    description?: string;
  }>;
  skills?: {
    categories?: { name: string; skills: string[] }[];
    // Legacy fields for old stored data
    technical?: string[];
    programming?: string[];
    frameworks?: string[];
    tools?: string[];
    soft?: string[];
  };
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    year?: string;
  }>;
  languages?: Array<{
    language: string;
    proficiency?: string;
  }>;
  achievements?: string[];
  lastUpdated?: string;
}

const Profile = () => {
  const { user } = useAuthContext();
  const [cvText, setCvText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [seniority, setSeniority] = useState<SeniorityLevel | undefined>(undefined);
  const [isSavingSeniority, setIsSavingSeniority] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);

  // Load existing CV data and profile settings
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setError("Please sign in to view your profile");
        setIsLoading(false);
        return;
      }

      try {
        console.log("Loading profile for user:", user.id);
        
        // Load profile settings including seniority
        const profileResult = await searchService.getProfile(user.id);
        if (profileResult.success && profileResult.profile) {
          setSeniority(profileResult.profile.seniority as SeniorityLevel | undefined);
        }
        
        // Load resume
        const result = await searchService.getResume(user.id);
        
        console.log("Resume loading result:", {
          success: result.success,
          hasResume: !!result.resume,
          error: result.error?.message
        });
        
        if (result.success && result.resume) {
          console.log("Resume data structure:", {
            hasContent: !!result.resume.content,
            hasParsedData: !!result.resume.parsed_data,
            contentLength: result.resume.content?.length || 0
          });
          
          setCvText(result.resume.content || "");
          
          // Use JSONB parsed_data for now until enhanced columns are available
          if (result.resume.parsed_data) {
            console.log("Using JSONB parsed_data");
            setParsedData(result.resume.parsed_data as ParsedData);
            console.log("Parsed data loaded from JSONB:", Object.keys(result.resume.parsed_data));
          } else {
            console.log("No parsed data found in resume");
          }
        } else if (!result.success && result.error) {
          console.error("Error loading resume:", result.error);
          setError(`Failed to load profile: ${result.error.message}`);
        } else {
          console.log("No resume found for user - this is normal for new users");
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load profile data");
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file || !user) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUploadingResume(true);
    setIsAnalyzing(true);

    try {
      const { text } = await extractResumeText(file);
      let parsedInfo: ParsedData | undefined;
      let analysisUnavailable = false;

      setCvText(text);

      const analysisResult = await searchService.analyzeCV(text);
      if (analysisResult.success) {
        parsedInfo = analysisResult.parsedData as ParsedData;
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
        parsedData: parsedInfo,
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

      if (parsedInfo) {
        setParsedData(parsedInfo);
      }
      setSuccess(
        analysisUnavailable
          ? "Resume uploaded and saved. Structured profile analysis is temporarily unavailable."
          : "Resume uploaded, parsed, and saved successfully.",
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (uploadError) {
      console.error("Error uploading resume:", uploadError);
      const message = uploadError instanceof ResumeUploadError
        ? uploadError.message
        : uploadError instanceof Error
          ? uploadError.message
          : "Failed to process that resume file.";

      setError(message);
    } finally {
      setIsAnalyzing(false);
      setIsUploadingResume(false);
    }
  };
  const handleSave = async () => {
    if (!user || !cvText.trim()) return;

    setIsSaving(true);
    setIsAnalyzing(true);
    setError(null);
    setSuccess(null);

    try {
      const analysisResult = await searchService.analyzeCV(cvText.trim());
      const analysisUnavailable = !analysisResult.success;

      if (analysisUnavailable) {
        console.warn(
          "CV analysis unavailable while saving profile resume. Saving text without parsed profile data.",
          analysisResult.error,
        );
      }

      const parsedInfo = analysisResult.success
        ? (analysisResult.parsedData as ParsedData)
        : undefined;
      setIsAnalyzing(false);
      
      const result = await searchService.saveResume({
        content: cvText.trim(),
        parsedData: parsedInfo
      });

      if (result.success) {
        if (parsedInfo) {
          setParsedData(parsedInfo);
        }
        setSuccess(
          analysisUnavailable
            ? "CV saved. Structured profile analysis is temporarily unavailable."
            : "CV saved and analyzed successfully with AI!",
        );
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error?.message || "Failed to save CV");
      }
    } catch (err) {
      console.error("Error saving CV:", err);
      setError("An unexpected error occurred while saving the CV");
      setIsAnalyzing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    if (window.confirm("Are you sure you want to delete your CV? This action cannot be undone.")) {
      setError(null);
      setSuccess(null);

      const result = await searchService.deleteResume();
      if (!result.success) {
        setError(result.error?.message || "Failed to delete CV");
        return;
      }

      setCvText("");
      setParsedData(null);
      setSuccess("CV deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleSaveSeniority = async (value: SeniorityLevel) => {
    if (!user) return;

    setIsSavingSeniority(true);
    setError(null);

    try {
      const result = await searchService.updateProfile({
        seniority: value
      });

      if (result.success) {
        setSeniority(value);
        setSuccess("Experience level updated successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error?.message || "Failed to update experience level");
      }
    } catch (err) {
      console.error("Error updating seniority:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsSavingSeniority(false);
    }
  };





  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
            <Card className="w-full max-w-md text-center">
              <CardHeader>
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <CardTitle>Loading Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Loading your CV and profile information...
                </p>
              </CardContent>
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
        <div className="max-w-6xl mx-auto">
          {/* Status Messages */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Parsed CV Information */}
            <div className="xl:col-span-2 space-y-6">
              {parsedData ? (
                <div className="space-y-6">
                  {/* Profile Header: Personal Info + Professional combined */}
                  {(parsedData.personalInfo || parsedData.professional) && (
                    <Card>
                      <CardHeader className="pb-3">
                        {parsedData.personalInfo?.name && (
                          <CardTitle className="text-xl">{parsedData.personalInfo.name}</CardTitle>
                        )}
                        {parsedData.professional?.currentRole && (
                          <CardDescription className="text-base">
                            {parsedData.professional.currentRole}
                            {parsedData.professional.experience && (
                              <span className="text-muted-foreground"> &middot; {parsedData.professional.experience}</span>
                            )}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Contact row */}
                        {parsedData.personalInfo && (
                          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                            {parsedData.personalInfo.email && (
                              <span className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" />
                                {parsedData.personalInfo.email}
                              </span>
                            )}
                            {parsedData.personalInfo.phone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5" />
                                {parsedData.personalInfo.phone}
                              </span>
                            )}
                            {parsedData.personalInfo.location && (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {parsedData.personalInfo.location}
                              </span>
                            )}
                            {parsedData.personalInfo.linkedin && (
                              <span className="flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5" />
                                {parsedData.personalInfo.linkedin}
                              </span>
                            )}
                            {parsedData.personalInfo.github && (
                              <span className="flex items-center gap-1.5">
                                <Code className="h-3.5 w-3.5" />
                                {parsedData.personalInfo.github}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Summary */}
                        {parsedData.professional?.summary && (
                          <>
                            <Separator />
                            <p className="text-sm">{parsedData.professional.summary}</p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Work History */}
                  {parsedData.professional?.workHistory && parsedData.professional.workHistory.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Briefcase className="h-4 w-4 text-primary" />
                          Work History
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {parsedData.professional.workHistory.map((job, index) => (
                            <div key={index} className="border-l-2 border-primary/20 pl-3 py-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="font-medium text-sm">{job.title}</p>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{job.duration}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{job.company}</p>
                              {job.description && (
                                <p className="text-xs mt-1 text-muted-foreground">{job.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Skills — dynamic categories with legacy fallback */}
                  {parsedData.skills && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Code className="h-4 w-4 text-primary" />
                          Skills & Technologies
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {parsedData.skills.categories && parsedData.skills.categories.length > 0 ? (
                          /* New dynamic categories */
                          parsedData.skills.categories.map((cat, index) => (
                            <div key={index} className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground min-w-[100px]">{cat.name}</span>
                              {cat.skills.map((skill, si) => (
                                <Badge key={si} variant={index === 0 ? "default" : "secondary"} className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          ))
                        ) : (
                          /* Legacy fallback for old stored data */
                          <>
                            {parsedData.skills.programming && parsedData.skills.programming.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground min-w-[100px]">Languages</span>
                                {parsedData.skills.programming.map((skill, i) => (
                                  <Badge key={i} variant="default" className="text-xs">{skill}</Badge>
                                ))}
                              </div>
                            )}
                            {parsedData.skills.frameworks && parsedData.skills.frameworks.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground min-w-[100px]">Frameworks</span>
                                {parsedData.skills.frameworks.map((skill, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                                ))}
                              </div>
                            )}
                            {parsedData.skills.tools && parsedData.skills.tools.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground min-w-[100px]">Tools</span>
                                {parsedData.skills.tools.map((skill, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {parsedData.skills.soft && parsedData.skills.soft.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground min-w-[100px]">Soft Skills</span>
                            {parsedData.skills.soft.map((skill, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Grid for smaller sections */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Education */}
                    {parsedData.education && parsedData.education.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            Education
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {parsedData.education.map((edu, index) => (
                            <div key={index} className="border-l-2 border-primary/20 pl-3">
                              <p className="font-medium text-sm">{edu.degree}</p>
                              <p className="text-xs text-muted-foreground">{edu.institution}</p>
                              {edu.year && <p className="text-xs text-muted-foreground">{edu.year}</p>}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Certifications */}
                    {parsedData.certifications && parsedData.certifications.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Award className="h-4 w-4 text-primary" />
                            Certifications
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5">
                          {parsedData.certifications.map((cert, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span>{cert.name}</span>
                              {cert.year && <Badge variant="outline" className="text-xs">{cert.year}</Badge>}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Projects */}
                    {parsedData.projects && parsedData.projects.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Building className="h-4 w-4 text-primary" />
                            Projects
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {parsedData.projects.map((project, index) => (
                            <div key={index}>
                              <p className="font-medium text-sm">{project.name}</p>
                              {project.description && project.description !== project.name && (
                                <p className="text-xs text-muted-foreground">{project.description}</p>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Achievements */}
                    {parsedData.achievements && parsedData.achievements.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Star className="h-4 w-4 text-primary" />
                            Key Achievements
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1.5">
                            {parsedData.achievements.map((achievement, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <Star className="h-3.5 w-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                                <span>{achievement}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* Languages */}
                    {parsedData.languages && parsedData.languages.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Globe className="h-4 w-4 text-primary" />
                            Languages
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5">
                          {parsedData.languages.map((lang, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span>{lang.language}</span>
                              {lang.proficiency && <Badge variant="outline" className="text-xs">{lang.proficiency}</Badge>}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No CV Information Available</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload or paste your CV content to see detailed parsed information
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* CV Editor Sidebar */}
            <div className="xl:col-span-1 space-y-4">
              {/* Experience Level — compact inline */}
              <Card>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="seniority" className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Experience Level
                    </Label>
                    {seniority && (
                      <Badge variant="outline" className="text-xs">
                        {seniority === 'junior' && 'Junior'}
                        {seniority === 'mid' && 'Mid-level'}
                        {seniority === 'senior' && 'Senior'}
                      </Badge>
                    )}
                  </div>
                  <Select
                    value={seniority || ""}
                    onValueChange={(value) => handleSaveSeniority(value as SeniorityLevel)}
                    disabled={isSavingSeniority}
                  >
                    <SelectTrigger id="seniority" className="w-full">
                      <SelectValue placeholder="Select level..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">Junior (0-2 years)</SelectItem>
                      <SelectItem value="mid">Mid-level (3-7 years)</SelectItem>
                      <SelectItem value="senior">Senior (8+ years)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Tailors question difficulty. Override per-search if needed.
                  </p>
                </CardContent>
              </Card>

              {/* CV Upload & Editor */}
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    CV / Resume
                  </CardTitle>
                  <CardDescription>
                    Upload a PDF or DOCX, or paste your CV text directly. Saved resume updates and deletion are both supported here.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Upload Section */}
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          Upload a PDF or DOCX to replace your current CV, or paste the text below.
                        </p>
                        <input
                          type="file"
                          accept={ACCEPTED_RESUME_TYPES}
                          onChange={handleFileUpload}
                          className="hidden"
                          id={PROFILE_CV_UPLOAD_ID}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(PROFILE_CV_UPLOAD_ID)?.click()}
                          disabled={isUploadingResume}
                        >
                          {isUploadingResume ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 mr-2" />
                          )}
                          {isUploadingResume ? "Processing..." : "Upload PDF / DOCX"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Text Editor */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CV Text</label>
                    <Textarea
                      value={cvText}
                      onChange={(e) => setCvText(e.target.value)}
                      rows={15}
                      className="resize-none font-mono text-sm"
                      placeholder="Paste or type your CV content here..."
                    />
                    <p className="text-xs text-muted-foreground">
                      This text will be used to personalize your interview questions and guidance.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={!cvText.trim() || isUploadingResume || isSaving}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete CV
                    </Button>

                    <Button
                      onClick={handleSave}
                      disabled={!cvText.trim() || isSaving || isAnalyzing || isUploadingResume}
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing with AI...
                        </>
                      ) : isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save & Analyze with AI"
                      )}
                    </Button>
                  </div>

                  {parsedData?.lastUpdated && (
                    <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                      Last updated: {parsedData.lastUpdated}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
