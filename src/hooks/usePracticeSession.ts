import { useEffect, useRef, useState } from "react";

export interface SavedPracticeAnswerRecord {
  id: string;
  questionId: string;
  question: string;
  stageName: string;
  textAnswer: string | null;
  transcriptText?: string | null;
  audioUrl?: string | null;
  selfRating?: number | null;
}

export function usePracticeSession(currentQuestionId?: string | null) {
  const [questionTimers, setQuestionTimers] = useState<Map<string, number>>(new Map());
  const [savedAnswers, setSavedAnswers] = useState<Map<string, boolean>>(new Map());
  const [savedAnswerRecords, setSavedAnswerRecords] = useState<SavedPracticeAnswerRecord[]>([]);
  const [currentQuestionTime, setCurrentQuestionTime] = useState(0);

  const startTimeRef = useRef(Date.now());
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    startTimeRef.current = Date.now();
    setCurrentQuestionTime(0);

    if (!currentQuestionId) {
      return;
    }

    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setCurrentQuestionTime((prev) => (prev === elapsedSeconds ? prev : elapsedSeconds));
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [currentQuestionId]);

  const resetCurrentQuestionTimer = () => {
    startTimeRef.current = Date.now();
    setCurrentQuestionTime(0);
  };

  const markAnswerSaved = ({
    questionId,
    timeSpent,
    answer,
  }: {
    questionId: string;
    timeSpent: number;
    answer: SavedPracticeAnswerRecord;
  }) => {
    setSavedAnswers((prev) => new Map(prev).set(questionId, true));
    setQuestionTimers((prev) => new Map(prev).set(questionId, timeSpent));
    setSavedAnswerRecords((prev) => {
      const next = prev.filter((record) => record.questionId !== questionId);
      next.push(answer);
      return next;
    });
  };

  const updateAnswerRating = (answerId: string, rating: number) => {
    setSavedAnswerRecords((prev) =>
      prev.map((record) => (record.id === answerId ? { ...record, selfRating: rating } : record)),
    );
  };

  const resetSessionState = () => {
    setQuestionTimers(new Map());
    setSavedAnswers(new Map());
    setSavedAnswerRecords([]);
    startTimeRef.current = Date.now();
    setCurrentQuestionTime(0);
  };

  return {
    currentQuestionTime,
    questionTimers,
    savedAnswers,
    savedAnswerRecords,
    markAnswerSaved,
    resetCurrentQuestionTimer,
    resetSessionState,
    updateAnswerRating,
  };
}
