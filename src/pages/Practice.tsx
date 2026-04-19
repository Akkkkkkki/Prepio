import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ChevronLeft, 
  RotateCcw, 
  Timer,
  CheckCircle,
  SkipForward,
  AlertCircle,
  Loader2,
  Brain,
  Play,
  Settings,
  Mic,
  MicOff,
  Square,
  Star,
  ArrowLeft,
  Info,
  MoreHorizontal,
  Pause,
  FileText,
  Trash2
} from "lucide-react";
import { searchService } from "@/services/searchService";
import { sessionSampler } from "@/services/sessionSampler";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SessionSummary } from "@/components/SessionSummary";
import { QuestionFrame } from "@/components/practice/QuestionFrame";
import { HintBanner } from "@/components/practice/HintBanner";
import { BottomPracticeNav } from "@/components/practice/BottomPracticeNav";
import { PracticeHelperDrawer } from "@/components/practice/PracticeHelperDrawer";
import { QuestionInsightsPanel } from "@/components/practice/QuestionInsightsPanel";
import { MobileCoachModal } from "@/components/practice/MobileCoachModal";
import { CompletionCheckmark } from "@/components/practice/CompletionCheckmark";
import { BreathingBreak, BREATHING_DISMISSED_KEY } from "@/components/practice/BreathingBreak";
import type { SavedPracticeAnswerRecord } from "@/hooks/usePracticeSession";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD_PX = 60;
const VERTICAL_SCROLL_SUPPRESSION_DELTA = 12;
const SWIPE_HINT_STORAGE_PREFIX = "practiceSwipeHintDismissed";
const ANSWER_AUTOSAVE_PREFIX = "practiceAnswerAutosave";
const AUTOSAVE_DELAY_MS = 5000;
const PRACTICE_SETUP_STORAGE_KEY = "practiceSetupDefaults";
const COMPLETE_SESSION_ERROR_MESSAGE = "We couldn't mark this session complete. Try again.";
const OFFLINE_PRACTICE_MESSAGE = "Reconnect to start practice, save answers, or update favorites.";
const RECOMMENDED_ANSWER_TIME_COPY = "Aim for 1-2 min";
const ABORTED_RECORDING_ERROR_MESSAGE =
  "Recording stopped before any audio was captured. Try again or switch to notes.";

const SETUP_STEPS = [
  { key: "goal", label: "Goal" },
  { key: "stages", label: "Stages" },
  { key: "filters", label: "Filters" },
  { key: "review", label: "Review" }
] as const;

const practicePresets = {
  quick: {
    label: "Quick Practice",
    description: "10 shuffled questions across all stages.",
    config: {
      sampleSize: 10,
      shuffle: true,
      categories: [] as string[],
      difficulties: [] as string[],
      favoritesOnly: false
    }
  },
  deep: {
    label: "Deep Dive",
    description: "30 sequential questions with full context.",
    config: {
      sampleSize: 30,
      shuffle: false,
      categories: [] as string[],
      difficulties: [] as string[],
      favoritesOnly: false
    }
  }
} as const;

type PracticeDefaults = {
  sampleSize: number;
  categories: string[];
  difficulties: string[];
  shuffle: boolean;
  favoritesOnly: boolean;
};

interface EnhancedQuestion {
  question: string;
  type: string;
  difficulty: string;
  rationale: string;
  suggested_answer_approach: string;
  evaluation_criteria: string[];
  follow_up_questions: string[];
  star_story_fit: boolean;
  company_context: string;
  depth_label?: string;
  good_answer_signals?: string[];
  weak_answer_signals?: string[];
  seniority_expectation?: string;
  sample_answer_outline?: string;
}

interface Question {
  id: string;
  stage_id: string;
  stage_name: string;
  question: string;
  answered: boolean;
  // Enhanced question properties
  type?: string;
  difficulty?: string;
  rationale?: string;
  suggested_answer_approach?: string;
  evaluation_criteria?: string[];
  follow_up_questions?: string[];
  star_story_fit?: boolean;
  company_context?: string;
  category?: string;
  depth_label?: string;
  good_answer_signals?: string[];
  weak_answer_signals?: string[];
  seniority_expectation?: string;
  sample_answer_outline?: string;
}

interface InterviewStage {
  id: string;
  name: string;
  duration: string | null;
  interviewer: string | null;
  content: string | null;
  guidance: string | null;
  order_index: number;
  search_id: string;
  created_at: string;
  questions: {
    id: string;
    question: string;
    created_at: string;
  }[];
  selected: boolean;
}

// Note: EnhancedQuestionBank interface removed - functionality consolidated into interview_questions

interface PracticeSession {
  id: string;
  user_id: string;
  search_id: string;
  started_at: string;
  completed_at?: string;
  session_notes?: string | null;
}

const Practice = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { isOffline } = useNetworkStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchId = searchParams.get('searchId');
  const urlStageIds = searchParams.get('stages')?.split(',') || [];
  const focusMode = searchParams.get("focus");
  const swipeHintStorageKey = useMemo(
    () => `${SWIPE_HINT_STORAGE_PREFIX}:${searchId ?? 'global'}`,
    [searchId]
  );
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allStages, setAllStages] = useState<InterviewStage[]>([]);
  const [searchData, setSearchData] = useState<{ status: string; company?: string; role?: string } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [questionTimers, setQuestionTimers] = useState<Map<string, number>>(new Map());
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<number>(Date.now());
  const [timerTick, setTimerTick] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyboardHint, setShowKeyboardHint] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('prepio_keyboard_hint_dismissed');
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<Map<string, boolean>>(new Map());
  const [savedAnswerRecords, setSavedAnswerRecords] = useState<SavedPracticeAnswerRecord[]>([]);
  const [isSavingRating, setIsSavingRating] = useState(false);
  
  // Question flags (Epic 1.3)
  const [questionFlags, setQuestionFlags] = useState<Record<string, { flag_type: string; id: string }>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showNeedsWorkOnly, setShowNeedsWorkOnly] = useState(focusMode === "needs_work");
  
  // Enhanced question filtering - applied filters (used during session)
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
  const [appliedDifficulties, setAppliedDifficulties] = useState<string[]>([]);
  const [appliedShuffle, setAppliedShuffle] = useState<boolean>(false);
  
  // Temporary filters during setup (not applied until session begins)
  const [tempCategories, setTempCategories] = useState<string[]>([]);
  const [tempDifficulties, setTempDifficulties] = useState<string[]>([]);
  const [tempShuffle, setTempShuffle] = useState<boolean>(false);
  
  // Session sampling
  const [sampleSize, setSampleSize] = useState<number>(10);
  const [useSampling, setUseSampling] = useState<boolean>(false);
  const [tempShowFavoritesOnly, setTempShowFavoritesOnly] = useState(false);
  
  // Session state: 'setup' | 'breathing' | 'inProgress' | 'completed'
  const [sessionState, setSessionState] = useState<'setup' | 'breathing' | 'inProgress' | 'completed'>('setup');
  const [setupStep, setSetupStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [mobileSetupMode, setMobileSetupMode] = useState<'quick' | 'custom'>('quick');
  const [rememberDefaults, setRememberDefaults] = useState(true);
  const [shouldShowSwipeHint, setShouldShowSwipeHint] = useState(false);
  const [isVerticalScrollGuarded, setIsVerticalScrollGuarded] = useState(false);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [isCoachSheetOpen, setIsCoachSheetOpen] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [mobileFooterHeight, setMobileFooterHeight] = useState(0);
  const [mobileFooterElement, setMobileFooterElement] = useState<HTMLDivElement | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hydratedAnswersRef = useRef<Set<string>>(new Set());
  const answeredIdsRef = useRef<Set<string>>(new Set());

  const getAutosaveKey = (questionId: string) =>
    `${ANSWER_AUTOSAVE_PREFIX}:${questionId}`;

  const clearAutosavedAnswer = (questionId: string) => {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(getAutosaveKey(questionId));
  };

  const clearSavedRecording = () => {
    setAudioBlob(null);
    setHasRecording(false);
    setRecordingTime(0);
  };

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  };

  const resetRecordingUi = () => {
    setIsRecording(false);
    setIsRecordingPaused(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setHasRecording(false);
  };

  const discardRecordingDraft = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch (error) {
        console.error("Error discarding recording", error);
      }
    }

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    stopMediaStream();
    resetRecordingUi();
  };

  const getMicrophoneErrorMessage = (error: unknown) => {
    if (error instanceof DOMException) {
      switch (error.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          return "Microphone access is blocked. Allow microphone access in your browser settings, then try again.";
        case "NotFoundError":
        case "DevicesNotFoundError":
          return "No microphone was found on this device. Connect one or use notes instead.";
        case "NotReadableError":
        case "TrackStartError":
          return "Your microphone is busy in another app. Close the other app and try again.";
        case "AbortError":
          return ABORTED_RECORDING_ERROR_MESSAGE;
        default:
          break;
      }
    }

    return "Microphone access failed. Check browser permissions and try again.";
  };
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Swipe gesture states
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [swipeDelta, setSwipeDelta] = useState(0);

  const loadPracticeDefaults = () => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem(PRACTICE_SETUP_STORAGE_KEY);
      if (stored) {
        const parsed: PracticeDefaults = JSON.parse(stored);
        if (typeof parsed.sampleSize === "number") {
          setSampleSize(parsed.sampleSize);
        }
        if (Array.isArray(parsed.categories)) {
          setTempCategories(parsed.categories);
        }
        if (Array.isArray(parsed.difficulties)) {
          setTempDifficulties(parsed.difficulties);
        }
        if (typeof parsed.shuffle === "boolean") {
          setTempShuffle(parsed.shuffle);
        }
        if (typeof parsed.favoritesOnly === "boolean") {
          setTempShowFavoritesOnly(parsed.favoritesOnly);
        }
        const isQuickDefault =
          parsed.sampleSize === practicePresets.quick.config.sampleSize &&
          parsed.categories.length === 0 &&
          parsed.difficulties.length === 0 &&
          parsed.shuffle === practicePresets.quick.config.shuffle &&
          parsed.favoritesOnly === practicePresets.quick.config.favoritesOnly;
        setMobileSetupMode(isQuickDefault ? 'quick' : 'custom');
        setRememberDefaults(true);
        return true;
      }
    } catch (error) {
      console.error("Failed to read practice defaults", error);
    }
    return false;
  };

  const persistPracticeDefaults = (defaults?: PracticeDefaults) => {
    if (typeof window === "undefined") return;
    if (!rememberDefaults) {
      localStorage.removeItem(PRACTICE_SETUP_STORAGE_KEY);
      return;
    }

    const payload: PracticeDefaults = defaults ?? {
      sampleSize,
      categories: tempCategories,
      difficulties: tempDifficulties,
      shuffle: tempShuffle,
      favoritesOnly: tempShowFavoritesOnly
    };

    try {
      localStorage.setItem(PRACTICE_SETUP_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist practice defaults", error);
    }
  };

  const handlePresetSelect = (presetKey: keyof typeof practicePresets) => {
    const preset = practicePresets[presetKey];
    setSelectedPreset(presetKey);
    setSampleSize(preset.config.sampleSize);
    setTempShuffle(preset.config.shuffle);
    setTempCategories([...preset.config.categories]);
    setTempDifficulties([...preset.config.difficulties]);
    setTempShowFavoritesOnly(preset.config.favoritesOnly);
  };

  const canProceedFromSetupStep = () => {
    switch (setupStep) {
      case 0:
        return sampleSize > 0;
      case 1:
        return allStages.some(stage => stage.selected);
      default:
        return true;
    }
  };

  const goToNextSetupStep = () => {
    if (setupStep < SETUP_STEPS.length - 1 && canProceedFromSetupStep()) {
      setSetupStep(prev => prev + 1);
    }
  };

  const goToPreviousSetupStep = () => {
    if (setupStep > 0) {
      setSetupStep(prev => prev - 1);
    }
  };

  const questionCategories = [
    { value: 'all', label: 'All Categories' },
    { value: 'behavioral', label: 'Behavioral' },
    { value: 'technical', label: 'Technical' },
    { value: 'situational', label: 'Situational' },
    { value: 'company_specific', label: 'Company Specific' },
    { value: 'role_specific', label: 'Role Specific' },
    { value: 'experience_based', label: 'Experience Based' },
    { value: 'cultural_fit', label: 'Cultural Fit' }
  ];

  const difficultyLevels = [
    { value: 'all', label: 'All Levels' },
    { value: 'Easy', label: 'Easy' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Hard', label: 'Hard' }
  ];

const getInterviewerFocus = (
  question: Question | null,
  meta?: { company?: string; role?: string }
) => {
  if (!question) return null;

  const summaryPieces = [question.rationale, question.company_context].filter(
    (piece): piece is string => Boolean(piece && piece.trim())
  );

  const evaluationCriteria = question.evaluation_criteria?.filter(
    (criterion): criterion is string => Boolean(criterion && criterion.trim())
  ) ?? [];

  const followUps = question.follow_up_questions?.filter(
    (followUp): followUp is string => Boolean(followUp && followUp.trim())
  ) ?? [];

  const answerApproach = question.suggested_answer_approach?.trim() || null;

  const hasData =
    summaryPieces.length > 0 ||
    evaluationCriteria.length > 0 ||
    followUps.length > 0 ||
    Boolean(answerApproach);

  if (!hasData) {
    return null;
  }

  return {
    summary: summaryPieces.join(' ').trim() || null,
    criteria: evaluationCriteria,
    followUps,
    answerApproach,
    meta: {
      company: meta?.company,
      role: meta?.role,
      difficulty: question.difficulty
    }
  };
};

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) || "" : "";

  // Load stored setup defaults on mount
  useEffect(() => {
    loadPracticeDefaults();
  }, []);

  // Load search data and set up stages
  useEffect(() => {
    const loadSearchData = async () => {
      if (!searchId) return;

      setIsLoading(true);
      setError(null);

      try {
        const result = await searchService.getSearchResults(searchId);
        
        if (result.success && result.search) {
          setSearchData(result.search);
          
          // Check if search is still processing
          if (result.search.status === 'pending' || result.search.status === 'processing') {
            setError(null); // Clear any previous errors
            return; // Don't process stages yet, show processing state
          }
          
          if (result.search.status === 'failed') {
            setError("Research processing failed. Please try starting a new search.");
            return;
          }
          
          // Only process stages if search is completed
          if (result.search.status === 'completed' && result.stages) {
            // Transform stages data and add selection state
            const transformedStages = result.stages
              .sort((a, b) => a.order_index - b.order_index)
              .map(stage => ({
                ...stage,
                selected: urlStageIds.length > 0 ? urlStageIds.includes(stage.id) : true // Default to all selected if no URL stages
              }));
            
            setAllStages(transformedStages);
            
            // Note: Enhanced questions now integrated into regular questions
            
            // Update URL if no stages were specified (select all by default)
            if (urlStageIds.length === 0) {
              const allStageIds = transformedStages.map(stage => stage.id);
              setSearchParams({ searchId, stages: allStageIds.join(',') });
            }
          }
        } else {
          setError(result.error?.message || "Failed to load search data");
        }
      } catch (err) {
        console.error("Error loading search data:", err);
        setError("An unexpected error occurred while loading search data");
      } finally {
        setIsLoading(false);
      }
    };

    loadSearchData();
  }, [searchId]);

  useEffect(() => {
    setShowNeedsWorkOnly(focusMode === "needs_work");
  }, [focusMode]);

  // Load question flags when stages are loaded (separate effect to avoid infinite loop)
  useEffect(() => {
    const loadFlags = async () => {
      const selectedStages = allStages.filter(stage => stage.selected);
      if (selectedStages.length === 0) return;

      const allQuestionIds: string[] = [];
      selectedStages.forEach(stage => {
        stage.questions?.forEach(questionObj => {
          allQuestionIds.push(questionObj.id);
        });
      });

      if (allQuestionIds.length > 0) {
        const flagsResult = await searchService.getQuestionFlags(allQuestionIds);
        if (flagsResult.success && flagsResult.flags) {
          setQuestionFlags(flagsResult.flags);
        }
      }
    };

    if (allStages.length > 0) {
      loadFlags();
    }
  }, [allStages]); // Only reload flags when stages change

  // Load practice session when stages are selected
  useEffect(() => {
    const loadPracticeSession = async () => {
      if (!searchId) return;

      const selectedStages = allStages.filter(stage => stage.selected);
      if (selectedStages.length === 0) {
        setQuestions([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const allQuestions: Question[] = [];
        
        // Load questions from stages (now all enhanced)
        {
          selectedStages.forEach(stage => {
            stage.questions?.forEach(questionObj => {
              allQuestions.push({
                id: questionObj.id,
                stage_id: stage.id,
                stage_name: stage.name,
                question: questionObj.question,
                answered: answeredIdsRef.current.has(questionObj.id),
                type: questionObj.type,
                difficulty: questionObj.difficulty,
                rationale: questionObj.rationale,
                suggested_answer_approach: questionObj.suggested_answer_approach,
                evaluation_criteria: questionObj.evaluation_criteria,
                follow_up_questions: questionObj.follow_up_questions,
                star_story_fit: questionObj.star_story_fit,
                company_context: questionObj.company_context,
                category: questionObj.category,
                depth_label: questionObj.depth_label,
                good_answer_signals: questionObj.good_answer_signals,
                weak_answer_signals: questionObj.weak_answer_signals,
                seniority_expectation: questionObj.seniority_expectation,
                sample_answer_outline: questionObj.sample_answer_outline
              });
            });
          });
        }

        // Apply filters and sorting
        let filteredQuestions = allQuestions;
        
        // Filter by categories (only if applied filters exist)
        if (appliedCategories.length > 0) {
          filteredQuestions = filteredQuestions.filter(q => 
            q.category && appliedCategories.includes(q.category)
          );
        }
        
        // Filter by difficulty (only if applied filters exist)
        if (appliedDifficulties.length > 0) {
          filteredQuestions = filteredQuestions.filter(q => 
            q.difficulty && appliedDifficulties.includes(q.difficulty)
          );
        }
        
        // Filter by favorites only (Epic 1.3) - uses questionFlags from separate effect
        if (showFavoritesOnly) {
          filteredQuestions = filteredQuestions.filter(q => 
            questionFlags[q.id]?.flag_type === 'favorite'
          );
        }

        if (showNeedsWorkOnly) {
          filteredQuestions = filteredQuestions.filter(
            (question) => questionFlags[question.id]?.flag_type === "needs_work",
          );
        }
        
        // Sort questions by stage order for consistent experience
        const sortedQuestions = filteredQuestions.sort((a, b) => {
          const stageA = selectedStages.find(s => s.id === a.stage_id);
          const stageB = selectedStages.find(s => s.id === b.stage_id);
          return (stageA?.order_index || 0) - (stageB?.order_index || 0);
        });
        
        // Fisher-Yates shuffle for unbiased randomization
        let processedQuestions = sortedQuestions;
        if (appliedShuffle) {
          processedQuestions = [...sortedQuestions];
          for (let i = processedQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [processedQuestions[i], processedQuestions[j]] = [processedQuestions[j], processedQuestions[i]];
          }
        }
        
        // Apply sampling if enabled
        if (useSampling && sampleSize > 0) {
          processedQuestions = sessionSampler.sampleQuestions(processedQuestions, sampleSize);
        }
        
        setQuestions(processedQuestions);

      } catch (err) {
        console.error("Error loading practice session:", err);
        setError("An unexpected error occurred while loading practice questions");
      } finally {
        setIsLoading(false);
      }
    };

    if (allStages.length > 0) {
      loadPracticeSession();
    }
  }, [
    allStages,
    appliedCategories,
    appliedDifficulties,
    appliedShuffle,
    questionFlags,
    searchId,
    showFavoritesOnly,
    showNeedsWorkOnly,
    useSampling,
    sampleSize,
  ]);

  // Reset timer when question changes
  useEffect(() => {
    setCurrentQuestionStartTime(Date.now());
    setIsCoachSheetOpen(false);
    setIsNotesExpanded(false);
    setRecordingError(null);
    discardRecordingDraft();
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (error) {
          console.error("Error stopping recorder on cleanup", error);
        }
      }
      stopMediaStream();
      audioChunksRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!currentQuestion) return;
    setAutosaveState('idle');
    if (typeof window === "undefined") return;
    if (hydratedAnswersRef.current.has(currentQuestion.id)) return;
    hydratedAnswersRef.current.add(currentQuestion.id);
    const storedAnswer = sessionStorage.getItem(getAutosaveKey(currentQuestion.id));
    if (!storedAnswer) return;
    setAnswers(prev => {
      if (prev.has(currentQuestion.id)) {
        return prev;
      }
      const next = new Map(prev);
      next.set(currentQuestion.id, storedAnswer);
      return next;
    });
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (!currentQuestion || sessionState !== 'inProgress') return;
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    setAutosaveState('saving');
    autosaveTimeoutRef.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(getAutosaveKey(currentQuestion.id), currentAnswer);
      }
      setAutosaveState('saved');
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
    };
  }, [currentAnswer, currentQuestion?.id, sessionState]);

  useEffect(() => {
    if (sessionState !== 'inProgress' || isMobile) {
      setShouldShowSwipeHint(false);
      return;
    }

    if (currentIndex === 0) {
      const dismissed =
        typeof window !== "undefined" &&
        sessionStorage.getItem(swipeHintStorageKey) === "true";
      setShouldShowSwipeHint(!dismissed);
    } else {
      setShouldShowSwipeHint(false);
    }
  }, [currentIndex, isMobile, sessionState, swipeHintStorageKey]);

  useLayoutEffect(() => {
    if (!isMobile || sessionState !== 'inProgress') {
      setMobileFooterHeight(0);
      return;
    }

    const footer = mobileFooterElement;
    if (!footer) return;

    const measureFooter = () => {
      setMobileFooterHeight(Math.ceil(footer.getBoundingClientRect().height));
    };

    measureFooter();

    const handleResize = () => measureFooter();
    window.addEventListener('resize', handleResize);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener('resize', handleResize);
    }

    const observer = new ResizeObserver(() => measureFooter());
    observer.observe(footer);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [
    currentQuestion?.id,
    hasRecording,
    isMobile,
    isNotesExpanded,
    isRecording,
    isRecordingPaused,
    mobileFooterElement,
    recordingError,
    sessionState,
  ]);

  // Recording timer
  useEffect(() => {
    if (isRecording && recordingIntervalRef.current === null) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (!isRecording && recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [isRecording]);

  const hideSwipeHint = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(swipeHintStorageKey, "true");
    }
    setShouldShowSwipeHint(false);
  };

  const handleDismissSwipeHint = () => {
    hideSwipeHint();
  };

  const handleStageToggle = (stageId: string) => {
    const updatedStages = allStages.map(stage => 
      stage.id === stageId 
        ? { ...stage, selected: !stage.selected }
        : stage
    );
    setAllStages(updatedStages);
    
    // Update URL with new stage selection
    const selectedStageIds = updatedStages.filter(stage => stage.selected).map(stage => stage.id);
    if (selectedStageIds.length > 0) {
      setSearchParams({ searchId: searchId!, stages: selectedStageIds.join(',') });
    }
  };

  const getCurrentQuestionTime = () => {
    return Math.floor((Date.now() - currentQuestionStartTime) / 1000);
  };

  const handleAnswerChange = (value: string) => {
    setAnswers(prev => {
      const next = new Map(prev);
      next.set(currentQuestion.id, value);
      return next;
    });
  };

  const startRecording = async () => {
    setRecordingError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError("Microphone recording is not supported in this browser. Use quick notes instead.");
      return;
    }

    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsRecording(true);
      setIsRecordingPaused(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        setRecordingError("No microphone input was detected. Choose another input or use notes instead.");
        return;
      }

      const mediaRecorder = new MediaRecorder(stream);

      stopMediaStream();
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      clearSavedRecording();
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        const recorderError = (event as Event & { error?: DOMException }).error;
        setRecordingError(getMicrophoneErrorMessage(recorderError ?? new DOMException("", "AbortError")));
      };

      mediaRecorder.onstop = () => {
        const nextBlob = audioChunksRef.current.length > 0
          ? new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })
          : null;

        setAudioBlob(nextBlob);
        setHasRecording(Boolean(nextBlob && nextBlob.size > 0));
        if (!nextBlob || nextBlob.size === 0) {
          setRecordingError(ABORTED_RECORDING_ERROR_MESSAGE);
        }
        stopMediaStream();
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        setIsRecording(false);
        setIsRecordingPaused(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingError(getMicrophoneErrorMessage(error));
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      stopMediaStream();
      setIsRecording(false);
      setIsRecordingPaused(false);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsRecording(false);
      setIsRecordingPaused(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsRecordingPaused(false);
    }
  };

  const playRecording = () => {
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
    }
  };

  const clearRecording = () => {
    setRecordingError(null);
    discardRecordingDraft();
  };

  const finalizeSession = async () => {
    if (!practiceSession) {
      setCompletionError(COMPLETE_SESSION_ERROR_MESSAGE);
      return false;
    }

    setCompletionError(null);

    try {
      const result = await searchService.completePracticeSession(practiceSession.id);

      if (!result.success || !result.session) {
        console.error("Failed to complete practice session:", result.error);
        setCompletionError(COMPLETE_SESSION_ERROR_MESSAGE);
        return false;
      }

      setPracticeSession(result.session);
      setSessionState('completed');
      return true;
    } catch (error) {
      console.error("Error completing practice session:", error);
      setCompletionError(COMPLETE_SESSION_ERROR_MESSAGE);
      return false;
    }
  };

  const beginSession = ({
    categories = tempCategories,
    difficulties = tempDifficulties,
    shuffle = tempShuffle,
    favoritesOnly = tempShowFavoritesOnly,
    stages = allStages,
    nextSampleSize = sampleSize,
    nextPreset = selectedPreset,
  }: {
    categories?: string[];
    difficulties?: string[];
    shuffle?: boolean;
    favoritesOnly?: boolean;
    stages?: InterviewStage[];
    nextSampleSize?: number;
    nextPreset?: string | null;
  } = {}) => {
    if (isOffline) {
      return false;
    }

    setAllStages(stages);
    setSampleSize(nextSampleSize);
    setAppliedCategories(categories);
    setAppliedDifficulties(difficulties);
    setAppliedShuffle(shuffle);
    setShowFavoritesOnly(favoritesOnly);

    const hasSelectedStages = stages.some(stage => stage.selected);
    if (!hasSelectedStages) {
      setSetupStep(1);
      setMobileSetupMode('custom');
      return false;
    }

    if (searchId) {
      const selectedStageIds = stages.filter(stage => stage.selected).map(stage => stage.id);
      const nextParams: Record<string, string> = {
        searchId,
        stages: selectedStageIds.join(','),
      };
      if (focusMode) {
        nextParams.focus = focusMode;
      }
      setSearchParams(nextParams);
    }

    persistPracticeDefaults({
      sampleSize: nextSampleSize,
      categories,
      difficulties,
      shuffle,
      favoritesOnly
    });
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(swipeHintStorageKey);
    }
    setShouldShowSwipeHint(!isMobile);
    setIsVerticalScrollGuarded(false);
    setCompletionError(null);
    setSetupStep(0);
    setSelectedPreset(nextPreset);
    setUseSampling(true);
    const breathingDismissed = localStorage.getItem(BREATHING_DISMISSED_KEY) === "true";
    setSessionState(breathingDismissed ? 'inProgress' : 'breathing');
    setCurrentIndex(0);
    setIsCoachSheetOpen(false);
    setIsNotesExpanded(false);
    setRecordingError(null);
    return true;
  };

  const startPracticeSession = async () => {
    if (!searchId) {
      return false;
    }

    const sessionResult = await searchService.createPracticeSession(searchId);
    if (!sessionResult.success || !sessionResult.session) {
      setError("We couldn't start the practice session. Please try again.");
      setSessionState("setup");
      return false;
    }

    setPracticeSession(sessionResult.session);
    return true;
  };

  const handleBeginSession = async () => {
    const didBegin = beginSession({
      nextPreset: isMobile ? null : selectedPreset
    });

    if (!didBegin) return;

    await startPracticeSession();
  };

  const handleBeginQuickStart = async () => {
    const selectedStages = allStages.some(stage => stage.selected)
      ? allStages
      : allStages.map(stage => ({ ...stage, selected: true }));
    const didBegin = beginSession({
      categories: [],
      difficulties: [],
      shuffle: practicePresets.quick.config.shuffle,
      favoritesOnly: practicePresets.quick.config.favoritesOnly,
      stages: selectedStages,
      nextSampleSize: practicePresets.quick.config.sampleSize,
      nextPreset: 'quick'
    });

    if (!didBegin) return;

    await startPracticeSession();
  };

  const handleStartNewSession = () => {
    setSessionState('setup');
    setSetupStep(0);
    setMobileSetupMode('quick');
    setUseSampling(false);
    setCurrentIndex(0);
    setAnswers(new Map());
    setQuestionTimers(new Map());
    setSavedAnswers(new Map());
    setSavedAnswerRecords([]);
    setPracticeSession(null);
    setShowNeedsWorkOnly(focusMode === "needs_work");
    
    // Reset filters
    setAppliedCategories([]);
    setAppliedDifficulties([]);
    setAppliedShuffle(false);
    setShowFavoritesOnly(false);
    const restoredDefaults = loadPracticeDefaults();
    if (!restoredDefaults) {
      setSampleSize(10);
      setTempCategories([]);
      setTempDifficulties([]);
      setTempShuffle(false);
      setTempShowFavoritesOnly(false);
    }
    setSelectedPreset(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(swipeHintStorageKey);
    }
    setShouldShowSwipeHint(false);
    setIsVerticalScrollGuarded(false);
    setCompletionError(null);
    setIsCoachSheetOpen(false);
    setIsNotesExpanded(false);
    setRecordingError(null);
    discardRecordingDraft();
  };
  
  const toggleCategory = (category: string) => {
    setTempCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  const toggleDifficulty = (difficulty: string) => {
    setTempDifficulties(prev => 
      prev.includes(difficulty) 
        ? prev.filter(d => d !== difficulty)
        : [...prev, difficulty]
    );
  };

  // Flag handling functions (Epic 1.3)
  const handleToggleFlag = async (questionId: string, flagType: 'favorite' | 'needs_work' | 'skipped') => {
    if (isOffline) {
      return;
    }

    try {
      const currentFlag = questionFlags[questionId];
      
      // If same flag type, remove it (toggle off)
      if (currentFlag && currentFlag.flag_type === flagType) {
        const result = await searchService.removeQuestionFlag(questionId);
        if (result.success) {
          setQuestionFlags(prev => {
            const newFlags = { ...prev };
            delete newFlags[questionId];
            return newFlags;
          });
        } else {
          console.error('Failed to remove flag:', result.error);
        }
      } else {
        // Set new flag (or update existing one)
        const result = await searchService.setQuestionFlag(questionId, flagType);
        if (result.success && result.flag) {
          setQuestionFlags(prev => ({
            ...prev,
            [questionId]: { flag_type: flagType, id: result.flag.id }
          }));
        } else {
          console.error('Failed to set flag:', result.error);
        }
      }
    } catch (error) {
      console.error('Error toggling flag:', error);
    }
  };

  const handleSaveAnswer = async () => {
    if (isOffline) return;

    const currentAnswer = answers.get(currentQuestion.id) || "";
    if (!currentAnswer.trim() && !hasRecording || !practiceSession) return;

    setCompletionError(null);
    setIsSaving(true);
    const questionId = currentQuestion.id;
    const timeSpent = getCurrentQuestionTime();
    
    try {
      let audioUrl: string | undefined;
      let transcriptText: string | undefined;

      if (audioBlob && user?.id) {
        const extension = audioBlob.type.split("/")[1]?.split(";")[0] || "webm";
        const audioPath = `${user.id}/${practiceSession.id}/${questionId}-${Date.now()}.${extension}`;
        const audioFile = new File([audioBlob], `practice-answer.${extension}`, {
          type: audioBlob.type || "audio/webm",
        });

        const uploadResult = await searchService.uploadPracticeAudio(audioFile, audioPath);
        if (!uploadResult.success || !uploadResult.path) {
          throw uploadResult.error ?? new Error("Failed to upload practice audio");
        }

        audioUrl = uploadResult.path;

        const transcriptionResult = await searchService.transcribePracticeAudio({
          path: uploadResult.path,
          mimeType: audioFile.type,
          fileName: audioFile.name,
        });

        if (transcriptionResult.success && typeof transcriptionResult.transcript === "string") {
          transcriptText = transcriptionResult.transcript.trim() || undefined;
        }
      }

      const result = await searchService.savePracticeAnswer({
        sessionId: practiceSession.id,
        questionId: questionId,
        textAnswer: currentAnswer.trim() || undefined,
        audioUrl,
        transcriptText,
        answerTime: timeSpent
      });

      if (result.success && result.answer) {
        // Mark question as answered
        answeredIdsRef.current.add(questionId);
        setQuestions(prev =>
          prev.map(q =>
            q.id === questionId ? { ...q, answered: true } : q
          )
        );
        setSavedAnswers(prev => new Map(prev).set(questionId, true));
        setSavedAnswerRecords((prev) => {
          const next = prev.filter((record) => record.questionId !== questionId);
          next.push({
            id: result.answer.id,
            questionId,
            question: currentQuestion.question,
            stageName: currentQuestion.stage_name,
            textAnswer: currentAnswer.trim() || null,
            transcriptText: transcriptText ?? null,
            audioUrl: audioUrl ?? null,
            selfRating: result.answer.self_rating ?? null,
          });
          return next;
        });
        
        // Save question time
        setQuestionTimers(prev => new Map(prev).set(questionId, timeSpent));

        clearAutosavedAnswer(questionId);
        setAutosaveState('saved');
        setShowCheckmark(true);
        clearRecording();
        
        // Check if this is the last question
        if (currentIndex >= questions.length - 1) {
          await finalizeSession();
        } else {
          // Auto-advance to next question
          setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
          }, 500);
        }
      } else {
        console.error("Failed to save answer:", result.error?.message);
      }
    } catch (err) {
      console.error("Error saving answer:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const skipQuestion = async () => {
    if (isRecording || isRecordingPaused || isSaving) return;

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return;
    }

    if (currentQuestion && canSubmitAnswer && !savedAnswers.get(currentQuestion.id)) {
      await handleSaveAnswer();
      return;
    }

    setIsSaving(true);
    try {
      await finalizeSession();
    } finally {
      setIsSaving(false);
    }
  };

  const jumpToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  };

  const resetCurrentQuestionTimer = () => {
    setCurrentQuestionStartTime(Date.now());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = questions.filter(q => q.answered).length;
  const selectedStagesCount = allStages.filter(stage => stage.selected).length;
  const currentQuestionTime = getCurrentQuestionTime();
  const interviewerFocus = getInterviewerFocus(currentQuestion ?? null, {
    company: searchData?.company,
    role: searchData?.role
  });

  const questionInsights = currentQuestion
    ? {
        summary: currentQuestion.rationale || interviewerFocus?.summary || currentQuestion.company_context,
        goodSignals: (currentQuestion.good_answer_signals && currentQuestion.good_answer_signals.length > 0)
          ? currentQuestion.good_answer_signals
          : interviewerFocus?.criteria,
        weakSignals: currentQuestion.weak_answer_signals,
        answerApproach: currentQuestion.suggested_answer_approach || interviewerFocus?.answerApproach,
        followUps: (currentQuestion.follow_up_questions && currentQuestion.follow_up_questions.length > 0)
          ? currentQuestion.follow_up_questions
          : interviewerFocus?.followUps,
        depthLabel: currentQuestion.depth_label,
        seniorityExpectation: currentQuestion.seniority_expectation,
        sampleAnswerOutline: currentQuestion.sample_answer_outline,
        meta: {
          company: searchData?.company,
          role: searchData?.role,
          difficulty: currentQuestion.difficulty
        }
      }
    : null;

  const answeredLookup = useMemo(() => {
    const lookup: Record<string, boolean> = {};
    questions.forEach(q => {
      lookup[q.id] = q.answered;
    });
    return lookup;
  }, [questions]);

  const questionOrder = useMemo(
    () => questions.map(q => ({ id: q.id, stage: q.stage_name })),
    [questions]
  );

  const voiceStatus = isRecording
    ? { label: `Recording ${formatTime(recordingTime)}`, variant: 'destructive' as const }
    : isRecordingPaused
      ? { label: `Paused ${formatTime(recordingTime)}`, variant: 'outline' as const }
    : hasRecording
      ? { label: `Preview ${formatTime(recordingTime)}`, variant: 'secondary' as const }
      : { label: 'Mic idle', variant: 'outline' as const };

  const autosaveStatusCopy =
    autosaveState === 'saving' ? 'Saving…' : autosaveState === 'saved' ? 'Saved locally' : 'Autosave ready';

  const hasTypedAnswer = Boolean(currentAnswer.trim());
  const canSubmitAnswer = hasTypedAnswer || hasRecording;
  const hasUnsavedCurrentResponse = Boolean(
    currentQuestion &&
    canSubmitAnswer &&
    !savedAnswers.get(currentQuestion.id)
  );
  const primaryCtaLabel = currentIndex >= questions.length - 1 ? 'Save & Finish' : 'Save & Continue';
  const isFinalQuestion = currentIndex >= questions.length - 1;
  const isPrimaryDisabled =
    isOffline || !canSubmitAnswer || isSaving || isRecording || isRecordingPaused;
  const isSkipDisabled =
    isSaving || isRecording || isRecordingPaused || (isOffline && isFinalQuestion);
  const skipActionLabel = currentIndex >= questions.length - 1
    ? hasUnsavedCurrentResponse ? 'Finish & Save' : 'Finish'
    : 'Skip';
  const networkGuardCopy = isFinalQuestion
    ? "Reconnect before you finish the session or save this answer."
    : OFFLINE_PRACTICE_MESSAGE;
  const mobileQuestionCount = mobileSetupMode === 'quick'
    ? practicePresets.quick.config.sampleSize
    : sampleSize;
  const estimateDurationRange = (count: number) => {
    const minMinutes = Math.max(5, Math.round(count * 1.5));
    const maxMinutes = Math.max(minMinutes + 2, Math.round(count * 2));
    return `${minMinutes} to ${maxMinutes} min`;
  };
  const notePreview = currentAnswer.trim()
    ? currentAnswer.trim().slice(0, 120)
    : "Tap Notes to keep a quick outline.";
  const recordingHeaderCopy = isRecording
    ? `REC ${formatTime(recordingTime)}`
    : isRecordingPaused
      ? `Paused ${formatTime(recordingTime)}`
      : formatTime(currentQuestionTime);
  const practiceHistoryHref = searchId ? `/history?searchId=${searchId}` : "/history";

  // Swipe handlers
  const handleSwipeLeft = () => {
    if (isSkipDisabled) return;
    if (isVerticalScrollGuarded) {
      setIsVerticalScrollGuarded(false);
      return;
    }
    hideSwipeHint();
    skipQuestion();
  };

  const handleSwipeRight = () => {
    if (isVerticalScrollGuarded) {
      setIsVerticalScrollGuarded(false);
      return;
    }
    hideSwipeHint();
    if (currentQuestion) {
      handleToggleFlag(currentQuestion.id, 'favorite');
    }
  };

  // Reset swipe state when question changes
  useEffect(() => {
    setSwipeDirection(null);
    setSwipeDelta(0);
  }, [currentIndex]);

  useEffect(() => {
    if (sessionState !== 'inProgress') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        if (currentIndex === 0) return;
        event.preventDefault();
        previousQuestion();
      } else if (event.key === 'ArrowRight') {
        if (isPrimaryDisabled) return;
        event.preventDefault();
        handleSaveAnswer();
      } else if (event.key.toLowerCase() === 's') {
        if (isSkipDisabled) return;
        event.preventDefault();
        skipQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    sessionState,
    currentIndex,
    questions.length,
    previousQuestion,
    skipQuestion,
    handleSaveAnswer,
    isPrimaryDisabled,
    isSkipDisabled
  ]);

  // Swipe configuration
  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      const { dir, deltaX, deltaY } = eventData;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absY > VERTICAL_SCROLL_SUPPRESSION_DELTA && absY > absX) {
        if (!isVerticalScrollGuarded) {
          setIsVerticalScrollGuarded(true);
        }
        setSwipeDirection(null);
        setSwipeDelta(0);
        return;
      }

      if (absX > absY && (dir === 'Left' || dir === 'Right')) {
        setSwipeDirection(dir.toLowerCase() as 'left' | 'right');
        setSwipeDelta(deltaX);
      }
    },
    onSwipedLeft: () => {
      setSwipeDirection(null);
      setSwipeDelta(0);
      handleSwipeLeft();
    },
    onSwipedRight: () => {
      setSwipeDirection(null);
      setSwipeDelta(0);
      handleSwipeRight();
    },
    onSwiped: () => {
      setTimeout(() => {
        setSwipeDirection(null);
        setSwipeDelta(0);
      }, 200);
      setIsVerticalScrollGuarded(false);
    },
    trackMouse: !isMobile,
    trackTouch: true,
    preventScrollOnSwipe: false,
    delta: SWIPE_THRESHOLD_PX,
  });

  // Update timer display every second
  useEffect(() => {
    const interval = setInterval(() => {
      // Increment timerTick to force re-render and update timer display
      if (currentQuestion) {
        setTimerTick(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQuestion]);

  // Show default state when no search ID provided
  if (!searchId) {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="p-8">
              <CardHeader>
                <div className="flex items-center justify-center mb-4">
                  <Play className="h-12 w-12 text-primary" />
                </div>
                <CardTitle>No Search Selected</CardTitle>
                <CardDescription>
                  Select a search to start practicing interview questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    onClick={() => navigate('/dashboard')}
                    size="lg"
                    className="w-full"
                  >
                    Go to Dashboard
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/')}
                    className="w-full"
                  >
                    Start New Search
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Only show full-screen loading during initial load, not during setup configuration
  if (isLoading && sessionState !== 'setup') {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto text-center">
            <CardHeader>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <CardTitle>Loading Practice Session</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Setting up your personalized interview practice...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show processing state when research is still being processed
  if (searchData && (searchData.status === 'pending' || searchData.status === 'processing')) {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto text-center">
            <CardHeader>
              <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Research In Progress</CardTitle>
              <CardDescription>
                {searchData.company && `for ${searchData.company}`}
                {searchData.role && ` - ${searchData.role}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Your interview research is still being processed. Practice mode will be available once the research is complete.
                </p>
                <div className="space-y-2">
                  <Button 
                    onClick={() => navigate(`/dashboard?searchId=${searchId}`)}
                    className="w-full"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    View Research Progress
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/')}
                    className="w-full"
                  >
                    Start New Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto text-center">
            <CardHeader>
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
              <CardTitle>Practice Session Error</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Button 
                  onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}
                  className="w-full"
                >
                  Back to Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="w-full"
                >
                  Start New Search
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If no questions available after filtering, show appropriate message
  if (!currentQuestion && sessionState === 'inProgress') {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto text-center">
            <CardHeader>
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <CardTitle>No Questions Match Your Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Your current filter settings resulted in no questions. Try adjusting your categories, difficulty levels, or selected stages.
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={handleStartNewSession}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Adjust Filters
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}
                  className="w-full"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (sessionState === 'breathing') {
    const handleBreathingDone = () => setSessionState('inProgress');
    return (
      <BreathingBreak onComplete={handleBreathingDone} onSkip={handleBreathingDone} />
    );
  }

  if (sessionState === 'setup' && isMobile) {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center justify-between px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}
              aria-label="Back to dashboard"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-sm font-medium">Practice setup</div>
            <Button variant="link" size="sm" asChild className="px-0 text-xs">
              <Link to={practiceHistoryHref}>History</Link>
            </Button>
          </div>
        </div>

        <div className="px-4 py-5 pb-8">
          <div className="space-y-5">
            <section className="rounded-[28px] border bg-muted/30 p-5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Practice summary
              </p>
              <div className="mt-3 space-y-1">
                <h1 className="text-xl font-semibold leading-tight">
                  {searchData?.company || "Practice session"}
                </h1>
                {(searchData?.role || searchData?.company) && (
                  <p className="text-sm text-muted-foreground">
                    {searchData?.role || "Interview practice"}
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-background/80 px-4 py-3 text-sm">
                <span>{mobileQuestionCount} question{mobileQuestionCount !== 1 ? 's' : ''}</span>
                <span className="text-muted-foreground">{estimateDurationRange(mobileQuestionCount)}</span>
              </div>
            </section>

            <section className="space-y-3">
              <button
                type="button"
                onClick={() => setMobileSetupMode('quick')}
                className={cn(
                  "w-full rounded-[24px] border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                  mobileSetupMode === 'quick'
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Quick start</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Jump in with 10 shuffled questions across your selected stages.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      mobileSetupMode === 'quick'
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    )}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMobileSetupMode('custom')}
                className={cn(
                  "w-full rounded-[24px] border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                  mobileSetupMode === 'custom'
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Custom session</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pick stages, tune difficulty, and keep the setup light.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      mobileSetupMode === 'custom'
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    )}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
                  </div>
                </div>
              </button>
            </section>

            {mobileSetupMode === 'custom' && (
              <section className="space-y-5 rounded-[28px] border bg-background p-5 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Question count</label>
                    <span className="text-sm text-muted-foreground">{sampleSize}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={sampleSize}
                    onChange={(e) => setSampleSize(sessionSampler.validateSampleSize(parseInt(e.target.value, 10) || 10))}
                    className="w-full accent-primary"
                    aria-label="Question count"
                  />
                  <p className="text-xs text-muted-foreground">
                    {estimateDurationRange(sampleSize)}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Stages</label>
                    <span className="text-xs text-muted-foreground">
                      {selectedStagesCount} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allStages.map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => handleStageToggle(stage.id)}
                        className={cn(
                          "rounded-full border px-3 py-2 text-sm transition",
                          stage.selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground"
                        )}
                      >
                        {stage.name}
                      </button>
                    ))}
                  </div>
                  {selectedStagesCount === 0 && (
                    <p className="text-xs text-destructive">Select at least one stage.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <div className="flex flex-wrap gap-2">
                    {difficultyLevels.filter(level => level.value !== 'all').map(level => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => toggleDifficulty(level.value)}
                        className={cn(
                          "rounded-full border px-3 py-2 text-sm transition",
                          tempDifficulties.includes(level.value)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground"
                        )}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Leave unselected to include every level.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Options</label>
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => setTempShuffle(prev => !prev)}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition",
                        tempShuffle ? "border-primary bg-primary/5" : "border-border bg-background"
                      )}
                    >
                      <span>Shuffle questions</span>
                      <span className="text-muted-foreground">{tempShuffle ? "On" : "Off"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTempShowFavoritesOnly(prev => !prev)}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition",
                        tempShowFavoritesOnly ? "border-primary bg-primary/5" : "border-border bg-background"
                      )}
                    >
                      <span>Favorites only</span>
                      <span className="text-muted-foreground">{tempShowFavoritesOnly ? "On" : "Off"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRememberDefaults(prev => !prev)}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition",
                        rememberDefaults ? "border-primary bg-primary/5" : "border-border bg-background"
                      )}
                    >
                      <span>Remember these defaults</span>
                      <span className="text-muted-foreground">{rememberDefaults ? "On" : "Off"}</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            <Button
              onClick={mobileSetupMode === 'quick' ? handleBeginQuickStart : handleBeginSession}
              disabled={isOffline || (mobileSetupMode === 'custom' && selectedStagesCount === 0)}
              className="h-12 w-full rounded-2xl text-base"
            >
              <Play className="mr-2 h-4 w-4" />
              Start practice
            </Button>
            {isOffline && (
              <p className="text-center text-sm text-amber-700">{OFFLINE_PRACTICE_MESSAGE}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Session Setup State - Single-screen layout with Quick Start default + Customize
  if (sessionState === 'setup') {
    const selectedStageQuestionCount = allStages
      .filter((s) => s.selected)
      .reduce((acc, s) => acc + (s.questions?.length || 0), 0);
    const quickStartCount = Math.min(
      practicePresets.quick.config.sampleSize,
      selectedStageQuestionCount || practicePresets.quick.config.sampleSize,
    );
    const desktopQuestionCount = mobileSetupMode === 'quick' ? quickStartCount : sampleSize;

    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto max-w-3xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <Button variant="link" size="sm" asChild className="px-0">
                <Link to={practiceHistoryHref}>View history</Link>
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {searchData?.company && `${searchData.company}`}
              {searchData?.role && ` - ${searchData.role}`}
            </div>
          </div>

          <Card className="motion-surface">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl tracking-tight">Ready to practice?</CardTitle>
              <CardDescription>
                Jump in with a Quick Start, or expand Customize to tune stages, difficulty, and filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <button
                type="button"
                onClick={handleBeginQuickStart}
                disabled={isOffline}
                className="motion-surface w-full rounded-2xl border border-primary bg-primary/5 p-5 text-left transition hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Play className="h-5 w-5 text-primary" />
                      <span className="text-base font-semibold text-foreground">Quick Start</span>
                      <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {quickStartCount} shuffled questions across your selected stages. {estimateDurationRange(desktopQuestionCount)}.
                    </p>
                  </div>
                  <div className="shrink-0 text-2xl text-primary">→</div>
                </div>
              </button>

              <Accordion type="single" collapsible>
                <AccordionItem value="customize" className="rounded-2xl border bg-muted/20 px-4">
                  <AccordionTrigger className="py-4 text-left text-sm hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span className="font-medium">Customize — stages, difficulty, filters</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pb-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Question count</label>
                        <span className="text-sm text-muted-foreground">{sampleSize}</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="1"
                        value={sampleSize}
                        onChange={(e) => setSampleSize(sessionSampler.validateSampleSize(parseInt(e.target.value, 10) || 10))}
                        className="w-full accent-primary"
                        aria-label="Question count"
                      />
                      <p className="text-xs text-muted-foreground">{estimateDurationRange(sampleSize)}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Stages</label>
                        <span className="text-xs text-muted-foreground">{selectedStagesCount} selected</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {allStages.map((stage, index) => {
                          const totalQuestions = stage.questions?.length || 0;
                          return (
                            <button
                              key={stage.id}
                              type="button"
                              onClick={() => handleStageToggle(stage.id)}
                              className={cn(
                                "flex items-center justify-between rounded-xl border p-3 text-left transition",
                                stage.selected ? "border-primary bg-primary/5" : "border-border bg-background",
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">Stage {index + 1}</Badge>
                                  <span className="truncate text-sm font-medium">{stage.name}</span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">{totalQuestions} question{totalQuestions !== 1 ? 's' : ''}</div>
                              </div>
                              <Checkbox
                                checked={stage.selected}
                                onCheckedChange={() => handleStageToggle(stage.id)}
                                aria-label={`Toggle ${stage.name}`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      {selectedStagesCount === 0 && (
                        <p className="text-xs text-destructive">Select at least one stage.</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Difficulty</label>
                      <div className="flex flex-wrap gap-2">
                        {difficultyLevels.filter(level => level.value !== 'all').map(level => (
                          <button
                            key={level.value}
                            type="button"
                            onClick={() => toggleDifficulty(level.value)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition",
                              tempDifficulties.includes(level.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background text-foreground",
                            )}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Leave empty to include every level.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Categories</label>
                      <div className="flex flex-wrap gap-2">
                        {questionCategories.filter(cat => cat.value !== 'all').map(cat => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => toggleCategory(cat.value)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition",
                              tempCategories.includes(cat.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background text-foreground",
                            )}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Options</label>
                      <div className="grid gap-2">
                        <button
                          type="button"
                          onClick={() => setTempShuffle(prev => !prev)}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition",
                            tempShuffle ? "border-primary bg-primary/5" : "border-border bg-background",
                          )}
                        >
                          <span>Shuffle questions</span>
                          <span className="text-muted-foreground">{tempShuffle ? "On" : "Off"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTempShowFavoritesOnly(prev => !prev)}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition",
                            tempShowFavoritesOnly ? "border-primary bg-primary/5" : "border-border bg-background",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                            Favorites only
                          </span>
                          <span className="text-muted-foreground">{tempShowFavoritesOnly ? "On" : "Off"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRememberDefaults(prev => !prev)}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition",
                            rememberDefaults ? "border-primary bg-primary/5" : "border-border bg-background",
                          )}
                        >
                          <span>Remember these defaults</span>
                          <span className="text-muted-foreground">{rememberDefaults ? "On" : "Off"}</span>
                        </button>
                      </div>
                    </div>

                    <Button
                      onClick={handleBeginSession}
                      disabled={isOffline || selectedStagesCount === 0}
                      className="motion-cta h-11 w-full"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Start custom session
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {isOffline && (
                <p className="text-sm text-amber-700">{OFFLINE_PRACTICE_MESSAGE}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Session Completed State - Show summary and new session button
  if (sessionState === 'completed') {
    const totalTime = Array.from(questionTimers.values()).reduce((sum, time) => sum + time, 0);
    const avgTime = answeredCount > 0 ? Math.floor(totalTime / answeredCount) : 0;
    const skippedCount = questions.length - answeredCount;
    const favoritedCount = questions.filter(q => questionFlags[q.id]?.flag_type === 'favorite').length;

    const handleSaveNotes = async (notes: string) => {
      if (!practiceSession) return false;
      if (isOffline) return false;
      
      setIsSavingNotes(true);
      try {
        const result = await searchService.savePracticeSessionNotes(practiceSession.id, notes);
        if (!result.success) {
          console.error("Failed to save session notes:", result.error);
          return false;
        }

        if (result.session) {
          setPracticeSession(result.session);
        }

        return true;
      } catch (error) {
        console.error("Error saving session notes:", error);
        return false;
      } finally {
        setIsSavingNotes(false);
      }
    };

    const handleRateAnswer = async (answerId: string, rating: number) => {
      setIsSavingRating(true);
      try {
        const result = await searchService.saveSelfRating(answerId, rating);
        if (!result.success) {
          console.error("Failed to save self rating:", result.error);
          return;
        }

        setSavedAnswerRecords((prev) =>
          prev.map((record) => (record.id === answerId ? { ...record, selfRating: rating } : record)),
        );
      } catch (error) {
        console.error("Error saving self rating:", error);
      } finally {
        setIsSavingRating(false);
      }
    };

    const needsWorkQuestionIds = new Set(
      Object.entries(questionFlags)
        .filter(([, flag]) => flag.flag_type === 'needs_work')
        .map(([qid]) => qid),
    );

    const handleToggleNeedsWork = async (questionId: string) => {
      await handleToggleFlag(questionId, 'needs_work');
    };

    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <SessionSummary
            answeredCount={answeredCount}
            totalQuestions={questions.length}
            skippedCount={skippedCount}
            favoritedCount={favoritedCount}
            totalTime={totalTime}
            avgTime={avgTime}
            onSaveNotes={handleSaveNotes}
            onStartNewSession={handleStartNewSession}
            onBackToDashboard={() => navigate(`/dashboard?searchId=${searchId}`)}
            historyHref={practiceHistoryHref}
            isSaving={isSavingNotes}
            disableSaveNotes={isOffline}
            saveNotesHelper={isOffline ? "Reconnect to save this reflection to your history." : undefined}
            savedAnswers={savedAnswerRecords}
            onRateAnswer={handleRateAnswer}
            isSavingRating={isSavingRating}
            needsWorkQuestionIds={needsWorkQuestionIds}
            onToggleNeedsWork={isOffline ? undefined : handleToggleNeedsWork}
          />
        </div>
      </div>
    );
  }

  if (isMobile) {
    const favoriteActive = questionFlags[currentQuestion.id]?.flag_type === 'favorite';

    return (
      <div
        data-mobile-practice-shell
        className={cn(
          "min-h-[100dvh] bg-background transition-[padding] duration-200"
        )}
        style={{ paddingBottom: mobileFooterHeight > 0 ? `${mobileFooterHeight}px` : undefined }}
      >
        <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-2 px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}
              aria-label="Back to dashboard"
              className="h-11 w-11"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1 text-center">
              <p className="text-sm font-semibold">
                Q{currentIndex + 1}/{questions.length || 1}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  isRecording
                    ? "bg-destructive/10 text-destructive"
                    : isRecordingPaused
                      ? "bg-amber-500/10 text-amber-700"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {recordingHeaderCopy}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Practice actions" className="h-11 w-11">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Practice actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {currentIndex > 0 && (
                    <DropdownMenuItem onClick={previousQuestion}>
                      Previous question
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={resetCurrentQuestionTimer}>
                    Reset timer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleStartNewSession}>
                    Change setup
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}>
                    Exit practice
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="h-1.5 w-full bg-muted">
            <div
              className="h-full rounded-r-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <main className="px-4 py-4">
          <div className="space-y-4">
            <QuestionFrame
              animateIn={false}
              className={cn(
                "rounded-[30px] border bg-card p-5 shadow-sm",
                swipeDirection === 'left'
                  ? 'transform -translate-x-2'
                  : swipeDirection === 'right'
                    ? 'transform translate-x-2'
                    : ''
              )}
              {...swipeHandlers}
            >
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {currentQuestion.stage_name}
                  </Badge>
                  {currentQuestion.difficulty && (
                    <Badge variant="outline">{currentQuestion.difficulty}</Badge>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="break-words text-xl font-semibold leading-8 text-foreground">
                    {currentQuestion.question}
                  </p>
                  {currentQuestion.answered && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      Answer saved
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-[24px] bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2 font-mono text-sm text-foreground">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    {formatTime(currentQuestionTime)}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Recommended
                    </p>
                    <p className="text-sm font-medium text-foreground">{RECOMMENDED_ANSWER_TIME_COPY}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                  <Button
                    type="button"
                    variant={favoriteActive ? "secondary" : "outline"}
                    onClick={() => handleToggleFlag(currentQuestion.id, 'favorite')}
                    disabled={isOffline}
                    className={cn(
                      "h-11 rounded-full px-4",
                      favoriteActive
                        ? "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-200"
                        : "text-muted-foreground"
                    )}
                  >
                    <Star className={cn("h-4 w-4", favoriteActive && "fill-current")} />
                    {favoriteActive ? "Favorited" : "Favorite"}
                  </Button>

                  {questionInsights && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCoachSheetOpen(true)}
                      className="h-11 rounded-full px-4 text-foreground"
                    >
                      Answer guide
                    </Button>
                  )}
                </div>
              </div>
            </QuestionFrame>

            {!isNotesExpanded && hasTypedAnswer && (
              <div className="rounded-[24px] border bg-muted/20 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Note preview
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{notePreview}</p>
              </div>
            )}
          </div>
        </main>

        <div
          ref={setMobileFooterElement}
          data-mobile-practice-footer
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/85"
        >
          <div
            className="mx-auto max-w-md space-y-3"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {(isRecording || isRecordingPaused) ? (
              <div className="rounded-[28px] border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Recording</p>
                    <p className="mt-1 text-2xl font-semibold">{formatTime(recordingTime)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-destructive">
                    <span className={cn("h-2.5 w-2.5 rounded-full", isRecording ? "animate-pulse bg-destructive" : "bg-amber-500")} />
                    {isRecording ? "Live" : "Paused"}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={clearRecording}
                    className="h-12 rounded-2xl border-destructive/20 bg-background"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={isRecording ? pauseRecording : startRecording}
                    className="h-12 rounded-2xl bg-background"
                  >
                    {isRecording ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-4 w-4" />
                        Resume
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border bg-card/90 p-3 shadow-sm">
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <Button
                    onClick={hasRecording ? playRecording : startRecording}
                    variant={hasRecording ? "outline" : "default"}
                    className="h-12 justify-start rounded-2xl px-4"
                  >
                    {hasRecording ? (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Play recording
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-4 w-4" />
                        Record answer
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant={isNotesExpanded ? "secondary" : "outline"}
                    onClick={() => setIsNotesExpanded(prev => !prev)}
                    className="h-12 rounded-2xl px-4"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Notes
                  </Button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {hasRecording
                      ? `Recording ready • ${formatTime(recordingTime)}`
                      : notePreview}
                  </span>
                  {hasRecording && (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="font-medium text-foreground"
                    >
                      Re-record
                    </button>
                  )}
                </div>
              </div>
            )}

            {recordingError && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {recordingError}
              </div>
            )}

            {isOffline && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                {networkGuardCopy}
              </div>
            )}

            {completionError && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {completionError}
              </div>
            )}

            {isNotesExpanded && (
              <div className="rounded-[28px] border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Quick notes</p>
                    <p className="text-xs text-muted-foreground">Saved on this device while you practice.</p>
                  </div>
                  <span className={cn("text-xs", autosaveState === 'saved' ? "text-green-600" : "text-muted-foreground")}>
                    {autosaveStatusCopy}
                  </span>
                </div>
                <Textarea
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  placeholder="Jot the beats you want to hit..."
                  className="mt-3 min-h-[132px] resize-none rounded-2xl border-0 bg-muted/30 text-sm shadow-none focus-visible:ring-1"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={skipQuestion}
                disabled={isSkipDisabled}
                className="h-12 rounded-2xl"
              >
                <SkipForward className="mr-2 h-4 w-4" />
                {skipActionLabel}
              </Button>

              {(isRecording || isRecordingPaused) ? (
                <Button
                  variant="destructive"
                  onClick={stopRecording}
                  className="h-12 rounded-2xl"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop recording
                </Button>
              ) : (
                <Button
                  onClick={handleSaveAnswer}
                  disabled={isPrimaryDisabled}
                  className="h-12 rounded-2xl"
                >
                  {isSaving ? 'Saving…' : primaryCtaLabel}
                </Button>
              )}
            </div>
          </div>
        </div>

        <MobileCoachModal
          open={isCoachSheetOpen}
          onOpenChange={setIsCoachSheetOpen}
          question={currentQuestion.question}
          insights={questionInsights}
        />
      </div>
    );
  }

  // Active Practice Session - Show questions
  return (
    <div id="main-content" className="min-h-screen bg-background">
      <Navigation />
      <span className="sr-only" aria-live="polite">
        Question {currentIndex + 1} of {questions.length}
      </span>
      <CompletionCheckmark visible={showCheckmark} />
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-32 lg:py-8 lg:pb-40">
        <div className="space-y-3 mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to dashboard
            </Button>
            <div className="text-sm text-muted-foreground sm:text-right">
              {searchData?.company && `${searchData.company}`}
              {searchData?.role && ` • ${searchData.role}`}
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/30 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  <span>Session progress</span>
                  <span>
                    Q{currentIndex + 1}/{questions.length || 1}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-right">
                  <div className="flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 font-mono">
                    <Timer className="h-4 w-4" />
                    {formatTime(currentQuestionTime)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{RECOMMENDED_ANSWER_TIME_COPY}</p>
                </div>
                <div className="text-muted-foreground">
                  {answeredCount} answered
                </div>
              </div>
            </div>
          </div>
        </div>

        {showKeyboardHint && !isMobile && (
          <div className="mb-4 flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
            <span>
              <kbd className="rounded border bg-background px-1.5 py-0.5 text-xs font-mono">←</kbd>
              {' '}<kbd className="rounded border bg-background px-1.5 py-0.5 text-xs font-mono">→</kbd>
              {' '}to navigate
              {' · '}
              <kbd className="rounded border bg-background px-1.5 py-0.5 text-xs font-mono">S</kbd>
              {' '}to skip
            </span>
            <button
              type="button"
              className="ml-4 text-xs hover:text-foreground transition-colors"
              onClick={() => {
                setShowKeyboardHint(false);
                localStorage.setItem('prepio_keyboard_hint_dismissed', '1');
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
          <section className="relative">
            {swipeDirection && (
              <div
                className={`absolute inset-0 z-10 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
                  swipeDirection === 'left' ? 'bg-red-500/20' : 'bg-amber-500/20'
                }`}
                style={{
                  opacity: Math.min(Math.abs(swipeDelta) / 100, 0.8),
                  transform:
                    swipeDirection === 'left'
                      ? `translateX(${Math.min(swipeDelta, 0)}px)`
                      : `translateX(${Math.max(swipeDelta, 0)}px)`
                }}
              >
                <div className="flex flex-col items-center gap-2 text-lg font-semibold">
                  {swipeDirection === 'left' && (
                    <>
                      <ArrowLeft className="h-8 w-8 text-red-600" />
                      <span className="text-red-600">Skip</span>
                    </>
                  )}
                  {swipeDirection === 'right' && (
                    <>
                      <Star className="h-8 w-8 text-amber-600 fill-current" />
                      <span className="text-amber-600">Favorite</span>
                    </>
                  )}
                </div>
              </div>
            )}
            <QuestionFrame
              className={
                swipeDirection === 'left'
                  ? 'transform -translate-x-2'
                  : swipeDirection === 'right'
                    ? 'transform translate-x-2'
                    : ''
              }
              {...swipeHandlers}
            >
              <CardHeader className="pb-4">
                {sessionState === 'inProgress' && shouldShowSwipeHint && (
                  <HintBanner onDismiss={handleDismissSwipeHint} />
                )}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
                      {currentQuestion.stage_name}
                    </Badge>
                    {currentQuestion.category && (
                      <Badge variant="outline" className="text-xs">
                        {currentQuestion.category.replace('_', ' ').toUpperCase()}
                      </Badge>
                    )}
                    {currentQuestion.difficulty && (
                      <Badge
                        variant={
                          currentQuestion.difficulty === 'Hard'
                            ? 'destructive'
                            : currentQuestion.difficulty === 'Medium'
                              ? 'default'
                              : 'secondary'
                        }
                        className="text-xs"
                      >
                        {currentQuestion.difficulty}
                      </Badge>
                    )}
                    {currentQuestion.star_story_fit && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                        STAR Method
                      </Badge>
                    )}
                    {currentQuestion.answered && (
                      <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Answered
                      </Badge>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={previousQuestion}
                      disabled={currentIndex === 0}
                      aria-label="Go to previous question"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={skipQuestion}
                      disabled={isSkipDisabled}
                      aria-label="Skip question"
                    >
                      <SkipForward className="h-4 w-4 mr-1" />
                      {skipActionLabel}
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg sm:text-xl leading-relaxed mb-4">
                  {currentQuestion.question}
                </CardTitle>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleFlag(currentQuestion.id, 'favorite')}
                    disabled={isOffline}
                    className={`h-7 px-2 ${
                      questionFlags[currentQuestion.id]?.flag_type === 'favorite'
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'text-muted-foreground hover:text-amber-600'
                    }`}
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        questionFlags[currentQuestion.id]?.flag_type === 'favorite' ? 'fill-current' : ''
                      }`}
                    />
                  </Button>
                </div>

              </CardHeader>

              <CardContent className="pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetCurrentQuestionTimer}
                    className="h-8 px-2"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset Timer
                  </Button>
                  <span>Timer resets when you navigate</span>
                </div>
              </CardContent>
            </QuestionFrame>
          </section>

          <aside className="space-y-4">
            <PracticeHelperDrawer
              key={`helpers-${currentQuestion.id}`}
              defaultOpen={currentIndex === 0}
              title="Practice tools"
              subtitle="Voice preview & quick notes"
            >
              <TooltipProvider delayDuration={150}>
                <div className="space-y-4">
                  {isOffline && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      {networkGuardCopy}
                    </div>
                  )}

                  <div className="space-y-3 rounded-2xl border bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        Voice preview
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground transition hover:text-foreground"
                              aria-label="Voice preview info"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Audio stays on this device until uploads ship.</TooltipContent>
                        </Tooltip>
                      </div>
                      <Badge variant={voiceStatus.variant} className="text-xs">
                        {voiceStatus.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isRecording && !hasRecording && (
                        <Button onClick={startRecording} className="flex-1 min-w-[140px]">
                          <Mic className="mr-2 h-4 w-4" />
                          Start recording
                        </Button>
                      )}

                      {isRecording && (
                        <Button onClick={stopRecording} variant="destructive" className="flex-1 min-w-[140px]">
                          <Square className="mr-2 h-4 w-4" />
                          Stop
                        </Button>
                      )}

                      {hasRecording && !isRecording && (
                        <>
                          <Button onClick={playRecording} variant="outline" className="flex-1 min-w-[140px]">
                            <Play className="mr-2 h-4 w-4" />
                            Play
                          </Button>
                          <Button onClick={startRecording} variant="outline" className="flex-1 min-w-[140px]">
                            <MicOff className="mr-2 h-4 w-4" />
                            Re-record
                          </Button>
                          <Button onClick={clearRecording} variant="ghost" size="sm" className="h-10 px-3">
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reset
                          </Button>
                        </>
                      )}
                    </div>

                    {recordingError && (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {recordingError}
                      </div>
                    )}

                    {completionError && (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {completionError}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-2xl border bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        Quick notes
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground transition hover:text-foreground"
                              aria-label="Notes info"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Notes auto-save to this device every few seconds until you submit.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className={`text-xs ${autosaveState === 'saved' ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {autosaveStatusCopy}
                      </span>
                    </div>
                    <Textarea
                      value={currentAnswer}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      placeholder="Capture bullet points or timing cues…"
                      className="min-h-[120px] resize-none text-sm"
                    />
                  </div>
                </div>
              </TooltipProvider>
            </PracticeHelperDrawer>

            <QuestionInsightsPanel data={questionInsights} />
          </aside>
        </div>

        <div className="flex justify-center">
          <BottomPracticeNav
            currentIndex={currentIndex}
            answeredMap={answeredLookup}
            questionOrder={questionOrder}
            onJump={jumpToQuestion}
            primaryLabel={isSaving ? 'Saving…' : primaryCtaLabel}
            primaryDisabled={isPrimaryDisabled}
            onPrimaryAction={handleSaveAnswer}
            isPrimaryLoading={isSaving}
          />
        </div>
      </div>
    </div>
  );
};

export default Practice;
