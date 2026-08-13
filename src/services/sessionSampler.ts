/**
 * Session Sampler Service
 * 
 * Provides intelligent question sampling for practice sessions.
 * Simple MVP implementation - no over-engineering.
 */

interface Question {
  id: string;
  stage_id: string;
  stage_name: string;
  question: string;
  answered: boolean;
  difficulty?: string;
  category?: string;
}

export const sessionSampler = {
  /**
   * Randomly sample N questions from the filtered list
   * 
   * @param questions - Already filtered questions (by stage, category, difficulty)
   * @param sampleSize - Number of questions to sample (default: 10)
   * @returns Randomly sampled questions
   */
  sampleQuestions(questions: Question[], sampleSize: number = 10): Question[] {
    // If we have fewer questions than requested, return all
    if (questions.length <= sampleSize) {
      return questions;
    }

    // Fisher-Yates shuffle algorithm for random sampling
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Return first N questions
    return shuffled.slice(0, sampleSize);
  },

  /**
   * Validate sample size input
   */
  validateSampleSize(value: number): number {
    // Ensure positive integer between 1 and 100
    const validated = Math.max(1, Math.min(100, Math.floor(value)));
    return validated;
  }
};

