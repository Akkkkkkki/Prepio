import { describe, expect, it } from "vitest";
import { sessionSampler } from "./sessionSampler";

const makeQuestion = (id: string, stageId = "stage-1") => ({
  id,
  stage_id: stageId,
  stage_name: "Technical",
  question: `Question ${id}`,
  answered: false,
});

describe("sessionSampler", () => {
  describe("sampleQuestions", () => {
    it("returns all questions when pool is smaller than sample size", () => {
      const questions = [makeQuestion("1"), makeQuestion("2")];
      const result = sessionSampler.sampleQuestions(questions, 10);
      expect(result).toHaveLength(2);
      expect(result).toEqual(questions);
    });

    it("returns exactly sampleSize questions when pool is larger", () => {
      const questions = Array.from({ length: 20 }, (_, i) =>
        makeQuestion(String(i)),
      );
      const result = sessionSampler.sampleQuestions(questions, 5);
      expect(result).toHaveLength(5);
    });

    it("returns all questions when pool equals sample size", () => {
      const questions = Array.from({ length: 10 }, (_, i) =>
        makeQuestion(String(i)),
      );
      const result = sessionSampler.sampleQuestions(questions, 10);
      expect(result).toHaveLength(10);
    });

    it("defaults to sample size 10", () => {
      const questions = Array.from({ length: 25 }, (_, i) =>
        makeQuestion(String(i)),
      );
      const result = sessionSampler.sampleQuestions(questions);
      expect(result).toHaveLength(10);
    });

    it("returns empty array for empty input", () => {
      const result = sessionSampler.sampleQuestions([], 5);
      expect(result).toHaveLength(0);
    });

    it("does not mutate the original array", () => {
      const questions = Array.from({ length: 15 }, (_, i) =>
        makeQuestion(String(i)),
      );
      const original = [...questions];
      sessionSampler.sampleQuestions(questions, 5);
      expect(questions).toEqual(original);
    });

    it("returns valid questions from the original pool", () => {
      const questions = Array.from({ length: 20 }, (_, i) =>
        makeQuestion(String(i)),
      );
      const result = sessionSampler.sampleQuestions(questions, 5);
      for (const q of result) {
        expect(questions).toContainEqual(q);
      }
    });

    it("produces different orderings across multiple calls (statistical)", () => {
      const questions = Array.from({ length: 50 }, (_, i) =>
        makeQuestion(String(i)),
      );
      const results = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const sample = sessionSampler.sampleQuestions(questions, 10);
        results.add(sample.map((q) => q.id).join(","));
      }
      // With 50 questions sampled to 10, getting the same order 10 times is astronomically unlikely
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe("validateSampleSize", () => {
    it("clamps values below 1 to 1", () => {
      expect(sessionSampler.validateSampleSize(0)).toBe(1);
      expect(sessionSampler.validateSampleSize(-5)).toBe(1);
    });

    it("clamps values above 100 to 100", () => {
      expect(sessionSampler.validateSampleSize(150)).toBe(100);
      expect(sessionSampler.validateSampleSize(999)).toBe(100);
    });

    it("floors floating point values", () => {
      expect(sessionSampler.validateSampleSize(5.7)).toBe(5);
      expect(sessionSampler.validateSampleSize(10.1)).toBe(10);
    });

    it("passes through valid integers unchanged", () => {
      expect(sessionSampler.validateSampleSize(1)).toBe(1);
      expect(sessionSampler.validateSampleSize(50)).toBe(50);
      expect(sessionSampler.validateSampleSize(100)).toBe(100);
    });
  });
});
