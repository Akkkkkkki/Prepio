import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ChevronLeft, 
  ChevronRight, 
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
  Info
} from "lucide-react";
import { searchService } from "@/services/searchService";
import { sessionSampler } from "@/services/sessionSampler";
import { useAuth } from "@/hooks/useAuth";
import { SessionSummary } from "@/components/SessionSummary";
import { QuestionFrame } from "@/components/practice/QuestionFrame";
import { HintBanner } from "@/components/practice/HintBanner";
import { BottomPracticeNav } from "@/components/practice/BottomPracticeNav";
import { PracticeHelperDrawer } from "@/components/practice/PracticeHelperDrawer";
import { QuestionInsightsPanel } from "@/components/practice/QuestionInsightsPanel";
import { PracticeSetupWizard } from "@/components/practice/PracticeSetupWizard";
import { VoiceRecorder } from "@/components/practice/VoiceRecorder";
import { usePracticeSession } from "@/hooks/usePracticeSession";

const SWIPE_THRESHOLD_PX = 60;
const VERTICAL_SCROLL_SUPPRESSION_DELTA = 12;
const SWIPE_HINT_STORAGE_PREFIX = "practiceSwipeHintDismissed";
const ANSWER_AUTOSAVE_PREFIX = "practiceAnswerAutosave";
const AUTOSAVE_DELAY_MS = 5000;
const PRACTICE_SETUP_STORAGE_KEY = "practiceSetupDefaults";

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isSavingRating, setIsSavingRating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  
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
  
  // Session state: 'setup' | 'inProgress' | 'completed'
  const [sessionState, setSessionState] = useState<'setup' | 'inProgress' | 'completed'>('setup');
  const [setupStep, setSetupStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [rememberDefaults, setRememberDefaults] = useState(true);
  const [shouldShowSwipeHint, setShouldShowSwipeHint] = useState(false);
  const [isVerticalScrollGuarded, setIsVerticalScrollGuarded] = useState(false);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hydratedAnswersRef = useRef<Set<string>>(new Set());

  const getAutosaveKey = (questionId: string) =>
    `${ANSWER_AUTOSAVE_PREFIX}:${questionId}`;

  const clearAutosavedAnswer = (questionId: string) => {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(getAutosaveKey(questionId));
  };
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Swipe gesture states
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [swipeDelta, setSwipeDelta] = useState(0);
  const {
    currentQuestionTime,
    questionTimers,
    savedAnswers,
    savedAnswerRecords,
    markAnswerSaved,
    resetCurrentQuestionTimer,
    resetSessionState,
    updateAnswerRating,
  } = usePracticeSession(questions[currentIndex]?.id);

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
        setRememberDefaults(true);
        return true;
      }
    } catch (error) {
      console.error("Failed to read practice defaults", error);
    }
    return false;
  };

  const persistPracticeDefaults = () => {
    if (typeof window === "undefined") return;
    if (!rememberDefaults) {
      localStorage.removeItem(PRACTICE_SETUP_STORAGE_KEY);
      return;
    }

    const payload: PracticeDefaults = {
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

  // Load practice questions when stages or filters change
  useEffect(() => {
    const loadPracticeQuestions = async () => {
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
                answered: false,
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
        
        // Filter by favorites only
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
        
        // Shuffle if requested
        let processedQuestions = appliedShuffle 
          ? sortedQuestions.sort(() => Math.random() - 0.5)
          : sortedQuestions;
        
        // Apply sampling if enabled
        if (useSampling && sampleSize > 0) {
          processedQuestions = sessionSampler.sampleQuestions(processedQuestions, sampleSize);
        }
        
        setQuestions(processedQuestions);
      } catch (err) {
        console.error("Error loading practice questions:", err);
        setError("An unexpected error occurred while loading practice questions");
      } finally {
        setIsLoading(false);
      }
    };

    if (allStages.length > 0) {
      loadPracticeQuestions();
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

  // Reset recorder when changing questions
  useEffect(() => {
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setHasRecording(false);
    setRecordingError(null);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [currentIndex]);

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
    if (sessionState !== 'inProgress') {
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
  }, [currentIndex, sessionState, swipeHintStorageKey]);

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

  const handleAnswerChange = (value: string) => {
    const newAnswers = new Map(answers);
    newAnswers.set(currentQuestion.id, value);
    setAnswers(newAnswers);
  };

  const startRecording = async () => {
    try {
      setRecordingError(null);
      setAudioBlob(null);
      setHasRecording(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : undefined;
      const mediaRecorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        setAudioBlob(audioBlob);
        setHasRecording(true);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingError('Could not access your microphone. Check browser permissions and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setHasRecording(false);
    setRecordingTime(0);
    setRecordingError(null);
  };

  const handleBeginSession = async () => {
    // Apply temporary filters to active filters
    setAppliedCategories(tempCategories);
    setAppliedDifficulties(tempDifficulties);
    setAppliedShuffle(tempShuffle);
    setShowFavoritesOnly(tempShowFavoritesOnly);
    const hasSelectedStages = allStages.some(stage => stage.selected);
    if (!hasSelectedStages) {
      setSetupStep(1);
      return;
    }
    persistPracticeDefaults();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(swipeHintStorageKey);
    }
    setShouldShowSwipeHint(true);
    setIsVerticalScrollGuarded(false);
    setSetupStep(0);
    setSelectedPreset(null);

    const sessionResult = await searchService.createPracticeSession(searchId!);
    if (!sessionResult.success || !sessionResult.session) {
      setError("We couldn't start the practice session. Please try again.");
      return;
    }

    setPracticeSession(sessionResult.session);
    setUseSampling(true);
    setSessionState('inProgress');
    setCurrentIndex(0);
  };

  const handleStartNewSession = () => {
    setSessionState('setup');
    setSetupStep(0);
    setUseSampling(false);
    setCurrentIndex(0);
    setAnswers(new Map());
    resetSessionState();
    setPracticeSession(null);
    
    // Reset filters
    setAppliedCategories([]);
    setAppliedDifficulties([]);
    setAppliedShuffle(false);
    setShowFavoritesOnly(false);
    setShowNeedsWorkOnly(focusMode === "needs_work");
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
    if (!currentQuestion || !practiceSession) return;

    const currentAnswer = answers.get(currentQuestion.id) || "";
    if ((!currentAnswer.trim() && !hasRecording) || !practiceSession) return;

    setIsSaving(true);
    const questionId = currentQuestion.id;
    const timeSpent = currentQuestionTime;
    
    try {
      let audioPath: string | undefined;
      let transcriptText: string | undefined;

      if (hasRecording && audioBlob && user) {
        const mimeType = audioBlob.type || "audio/webm";
        const extension = mimeType.split("/")[1] || "webm";
        const file = new File([audioBlob], `practice-answer.${extension}`, { type: mimeType });
        const safeQuestionId = questionId.replace(/[^a-zA-Z0-9-]/g, "");
        const audioUploadPath = `${user.id}/${practiceSession.id}/${safeQuestionId}-${Date.now()}.${extension}`;

        const uploadResult = await searchService.uploadPracticeAudio(file, audioUploadPath);
        if (!uploadResult.success || !uploadResult.path) {
          throw new Error(uploadResult.error instanceof Error ? uploadResult.error.message : "Failed to upload voice answer");
        }
        audioPath = uploadResult.path;

        const transcriptionResult = await searchService.transcribePracticeAudio({
          path: uploadResult.path,
          mimeType,
          fileName: file.name,
        });

        if (transcriptionResult.success) {
          transcriptText = transcriptionResult.transcript?.trim() || undefined;
        } else {
          console.warn("Voice transcription failed", transcriptionResult.error);
        }
      }

      const result = await searchService.savePracticeAnswer({
        sessionId: practiceSession.id,
        questionId: questionId,
        textAnswer: currentAnswer.trim() || null,
        audioUrl: audioPath,
        transcriptText,
        answerTime: timeSpent
      });

      if (result.success && result.answer) {
        // Mark question as answered
        setQuestions(prev => 
          prev.map(q => 
            q.id === questionId ? { ...q, answered: true } : q
          )
        );

        markAnswerSaved({
          questionId,
          timeSpent,
          answer: {
            id: result.answer.id,
            questionId,
            question: currentQuestion.question,
            stageName: currentQuestion.stage_name,
            textAnswer: currentAnswer.trim() || null,
            transcriptText: transcriptText || null,
            audioUrl: audioPath || null,
            selfRating: (result.answer as Record<string, unknown>).self_rating as number | null | undefined,
          },
        });

        clearAutosavedAnswer(questionId);
        setAutosaveState('saved');
        setRecordingError(null);
        
        // Check if this is the last question
        if (currentIndex >= questions.length - 1) {
          await searchService.completePracticeSession(practiceSession.id);
          setSessionState('completed');
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

  const skipQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const jumpToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = questions.filter(q => q.answered).length;
  const selectedStagesCount = allStages.filter(stage => stage.selected).length;
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
    : hasRecording
      ? { label: `Preview ${formatTime(recordingTime)}`, variant: 'secondary' as const }
      : { label: 'Mic idle', variant: 'outline' as const };

  const autosaveStatusCopy =
    autosaveState === 'saving' ? 'Saving…' : autosaveState === 'saved' ? 'Saved locally' : 'Autosave ready';

  const hasTypedAnswer = Boolean(currentAnswer.trim());
  const canSubmitAnswer = hasTypedAnswer || hasRecording;
  const primaryCtaLabel = currentIndex >= questions.length - 1 ? 'Save & Finish' : 'Save & Continue';
  const isPrimaryDisabled = !canSubmitAnswer || isSaving;

  const handleRateAnswer = async (answerId: string, rating: number) => {
    setIsSavingRating(true);
    try {
      const result = await searchService.saveSelfRating(answerId, rating);
      if (result.success) {
        updateAnswerRating(answerId, rating);
      }
    } finally {
      setIsSavingRating(false);
    }
  };

  // Swipe handlers
  const handleSwipeLeft = () => {
    if (isVerticalScrollGuarded) {
      setIsVerticalScrollGuarded(false);
      return;
    }
    hideSwipeHint();
    if (currentIndex < questions.length - 1) {
      skipQuestion();
    }
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
        if (!canSubmitAnswer || isSaving) return;
        event.preventDefault();
        handleSaveAnswer();
      } else if (event.key.toLowerCase() === 's') {
        if (currentIndex >= questions.length - 1) return;
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
    canSubmitAnswer,
    isSaving
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
    trackMouse: true, // Enable mouse drag for desktop
    trackTouch: true, // Enable touch for mobile
    preventScrollOnSwipe: false,
    delta: SWIPE_THRESHOLD_PX,
  });

  // Show default state when no search ID provided
  if (!searchId) {
    return (
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
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

  // Session Setup State - Show filters and configuration
  if (sessionState === 'setup') {
    return (
      <>
        <Navigation />
        <PracticeSetupWizard
          searchId={searchId}
          company={searchData?.company}
          role={searchData?.role}
          setupStep={setupStep}
          setupSteps={SETUP_STEPS}
          selectedPreset={selectedPreset}
          practicePresets={practicePresets}
          onPresetSelect={(presetKey) => handlePresetSelect(presetKey as keyof typeof practicePresets)}
          sampleSize={sampleSize}
          onSampleSizeChange={(value) => setSampleSize(sessionSampler.validateSampleSize(value))}
          allStages={allStages}
          onStageToggle={handleStageToggle}
          selectedStagesCount={selectedStagesCount}
          questionCategories={questionCategories}
          tempCategories={tempCategories}
          toggleCategory={toggleCategory}
          difficultyLevels={difficultyLevels}
          tempDifficulties={tempDifficulties}
          toggleDifficulty={toggleDifficulty}
          tempShuffle={tempShuffle}
          setTempShuffle={setTempShuffle}
          tempShowFavoritesOnly={tempShowFavoritesOnly}
          setTempShowFavoritesOnly={setTempShowFavoritesOnly}
          rememberDefaults={rememberDefaults}
          setRememberDefaults={setRememberDefaults}
          canProceedFromSetupStep={canProceedFromSetupStep()}
          onPrevious={goToPreviousSetupStep}
          onNext={goToNextSetupStep}
          onStart={handleBeginSession}
          onBack={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}
          showNeedsWorkOnly={showNeedsWorkOnly}
        />
      </>
    );
  }

  // Session Completed State - Show summary and new session button
  if (sessionState === 'completed') {
    const totalTime = Array.from(questionTimers.values()).reduce((sum, time) => sum + time, 0);
    const avgTime = answeredCount > 0 ? Math.floor(totalTime / answeredCount) : 0;
    const skippedCount = questions.length - answeredCount;
    const favoritedCount = questions.filter(q => questionFlags[q.id]?.flag_type === 'favorite').length;

    const handleSaveNotes = async (notes: string) => {
      if (!practiceSession) return;
      
      setIsSavingNotes(true);
      try {
        const result = await searchService.completePracticeSession(practiceSession.id, notes);
        if (!result.success) {
          console.error("Failed to save session notes:", result.error);
        }
      } catch (error) {
        console.error("Error saving session notes:", error);
      } finally {
        setIsSavingNotes(false);
      }
    };

    return (
      <div className="min-h-screen bg-background">
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
            isSaving={isSavingNotes}
            savedAnswers={savedAnswerRecords}
            onRateAnswer={handleRateAnswer}
            isSavingRating={isSavingRating}
          />
        </div>
      </div>
    );
  }

  // Active Practice Session - Show questions
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
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
                <div className="flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 font-mono">
                  <Timer className="h-4 w-4" />
                  {formatTime(currentQuestionTime)}
                </div>
                <div className="text-muted-foreground">
                  {answeredCount} answered
                </div>
              </div>
            </div>
          </div>
        </div>

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
                      disabled={currentIndex >= questions.length - 1}
                      aria-label="Skip question"
                    >
                      <SkipForward className="h-4 w-4 mr-1" />
                      Skip
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
                  <VoiceRecorder
                    isRecording={isRecording}
                    hasRecording={hasRecording}
                    recordingTimeLabel={hasRecording ? `${formatTime(recordingTime)} captured` : `${formatTime(recordingTime)} ready`}
                    statusLabel={voiceStatus.label}
                    statusVariant={voiceStatus.variant}
                    onStartRecording={startRecording}
                    onStopRecording={stopRecording}
                    onPlayRecording={playRecording}
                    onClearRecording={clearRecording}
                    helperText="Audio is uploaded when you save the answer. We also attempt a transcript so you can review it later."
                    error={recordingError}
                  />

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
