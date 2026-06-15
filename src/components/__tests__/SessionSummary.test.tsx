import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { SessionSummary } from "../SessionSummary";
import type { SavedPracticeAnswerRecord } from "@/hooks/usePracticeSession";
import type { AnswerFeedback } from "@/shared/answer-feedback";

const baseProps = {
  answeredCount: 1,
  totalQuestions: 1,
  skippedCount: 0,
  favoritedCount: 0,
  totalTime: 120,
  avgTime: 120,
  onSaveNotes: vi.fn().mockResolvedValue(true),
  onStartNewSession: vi.fn(),
  onBackToDashboard: vi.fn(),
};

const renderSummary = (savedAnswers: SavedPracticeAnswerRecord[]) =>
  render(
    <MemoryRouter>
      <SessionSummary
        {...baseProps}
        savedAnswers={savedAnswers}
        onRateAnswer={vi.fn().mockResolvedValue(undefined)}
      />
    </MemoryRouter>,
  );

describe("SessionSummary rubric self-check", () => {
  it("renders good and weak signals from the saved answer", () => {
    renderSummary([
      {
        id: "answer-1",
        questionId: "q-1",
        question: "Tell me about a hard tradeoff.",
        stageName: "Behavioral",
        textAnswer: "I picked the smaller scope to ship on time.",
        goodSignals: ["Tie the choice to a measurable outcome.", "Name the alternative considered."],
        weakSignals: ["Skipping the cost you accepted."],
      },
    ]);

    expect(screen.getByText("Self-check rubric")).toBeInTheDocument();
    expect(
      screen.getByText("Tie the choice to a measurable outcome."),
    ).toBeInTheDocument();
    expect(screen.getByText("Name the alternative considered.")).toBeInTheDocument();
    expect(screen.getByText("Skipping the cost you accepted.")).toBeInTheDocument();
  });

  it("toggles a good-signal checkbox without affecting siblings", () => {
    renderSummary([
      {
        id: "answer-1",
        questionId: "q-1",
        question: "Tell me about a hard tradeoff.",
        stageName: "Behavioral",
        textAnswer: "I picked the smaller scope to ship on time.",
        goodSignals: ["Tie the choice to a measurable outcome.", "Name the alternative considered."],
        weakSignals: [],
      },
    ]);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toHaveAttribute("data-state", "unchecked");
    expect(checkboxes[1]).toHaveAttribute("data-state", "unchecked");

    fireEvent.click(checkboxes[0]);

    expect(checkboxes[0]).toHaveAttribute("data-state", "checked");
    expect(checkboxes[1]).toHaveAttribute("data-state", "unchecked");
  });

  it("does not render the rubric block when no signals are present", () => {
    renderSummary([
      {
        id: "answer-1",
        questionId: "q-1",
        question: "Tell me about a hard tradeoff.",
        stageName: "Behavioral",
        textAnswer: "I picked the smaller scope to ship on time.",
        goodSignals: null,
        weakSignals: null,
      },
    ]);

    expect(screen.queryByText("Self-check rubric")).not.toBeInTheDocument();
  });

  it("keeps each answer's checked state isolated", () => {
    renderSummary([
      {
        id: "answer-1",
        questionId: "q-1",
        question: "First question.",
        stageName: "Behavioral",
        textAnswer: "First answer.",
        goodSignals: ["Signal A"],
        weakSignals: [],
      },
      {
        id: "answer-2",
        questionId: "q-2",
        question: "Second question.",
        stageName: "Behavioral",
        textAnswer: "Second answer.",
        goodSignals: ["Signal A"],
        weakSignals: [],
      },
    ]);

    const cards = screen.getAllByText("Signal A").map((node) => node.closest("li"));
    expect(cards).toHaveLength(2);

    const firstCheckbox = within(cards[0] as HTMLElement).getByRole("checkbox");
    const secondCheckbox = within(cards[1] as HTMLElement).getByRole("checkbox");

    fireEvent.click(firstCheckbox);

    expect(firstCheckbox).toHaveAttribute("data-state", "checked");
    expect(secondCheckbox).toHaveAttribute("data-state", "unchecked");
  });

  it("does not show a feedback generation action for free users", () => {
    renderSummary([
      {
        id: "answer-1",
        questionId: "q-1",
        question: "Tell me about a hard tradeoff.",
        stageName: "Behavioral",
        textAnswer: "I picked the smaller scope to ship on time.",
        goodSignals: [],
        weakSignals: [],
      },
    ]);

    expect(screen.getByText("Detailed coaching is paid")).toBeInTheDocument();
    expect(
      screen.getByText(/Free answers stay saved and rateable without generating AI feedback/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /get detailed coaching/i })).not.toBeInTheDocument();
  });

  it("shows the feedback generation action for paid users", () => {
    render(
      <MemoryRouter>
        <SessionSummary
          {...baseProps}
          savedAnswers={[
            {
              id: "answer-1",
              questionId: "q-1",
              question: "Tell me about a hard tradeoff.",
              stageName: "Behavioral",
              textAnswer: "I picked the smaller scope to ship on time.",
              goodSignals: [],
              weakSignals: [],
            },
          ]}
          onRateAnswer={vi.fn().mockResolvedValue(undefined)}
          answerFeedbackAccess="paid"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /get detailed coaching/i })).toBeInTheDocument();
  });

  it("generates and renders feedback for a paid user", async () => {
    const generated: AnswerFeedback = {
      id: "fb-1",
      practiceAnswerId: "answer-1",
      model: "gpt-4o-mini",
      createdAt: null,
      strengths: [{ text: "Owned the outcome" }],
      improvements: [{ text: "Add a number" }],
      starBreakdown: { situation: "", task: "", action: "", result: "" },
      nextAction: { text: "Re-tell with a metric." },
    };
    const onGenerateFeedback = vi.fn().mockResolvedValue({ success: true, feedback: generated });

    render(
      <MemoryRouter>
        <SessionSummary
          {...baseProps}
          savedAnswers={[
            {
              id: "answer-1",
              questionId: "q-1",
              question: "Tell me about a hard tradeoff.",
              stageName: "Behavioral",
              textAnswer: "I picked the smaller scope to ship on time.",
              goodSignals: [],
              weakSignals: [],
            },
          ]}
          onRateAnswer={vi.fn().mockResolvedValue(undefined)}
          answerFeedbackAccess="paid"
          onGenerateFeedback={onGenerateFeedback}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /get detailed coaching/i }));

    expect(onGenerateFeedback).toHaveBeenCalledWith("answer-1", false);
    expect(await screen.findByText("Owned the outcome")).toBeInTheDocument();
    expect(screen.getByText(/Re-tell with a metric/)).toBeInTheDocument();
  });

  it("shows pre-loaded feedback without a generate click", () => {
    render(
      <MemoryRouter>
        <SessionSummary
          {...baseProps}
          savedAnswers={[
            {
              id: "answer-1",
              questionId: "q-1",
              question: "Tell me about a hard tradeoff.",
              stageName: "Behavioral",
              textAnswer: "I picked the smaller scope to ship on time.",
              goodSignals: [],
              weakSignals: [],
            },
          ]}
          onRateAnswer={vi.fn().mockResolvedValue(undefined)}
          answerFeedbackAccess="paid"
          onGenerateFeedback={vi.fn()}
          feedbackByAnswerId={{
            "answer-1": {
              id: "fb-9",
              practiceAnswerId: "answer-1",
              model: null,
              createdAt: null,
              strengths: [{ text: "Concrete example" }],
              improvements: [],
              starBreakdown: { situation: "", task: "", action: "", result: "" },
              nextAction: { text: "Tighten the opening." },
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Concrete example")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /get detailed coaching/i }),
    ).not.toBeInTheDocument();
  });
});
