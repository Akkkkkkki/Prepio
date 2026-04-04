import { describe, expect, it, vi } from "vitest";

// Mock supabase client before importing the module under test
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

import {
  formatProgressStep,
  getProgressColor,
  getProgressIcon,
} from "../useSearchProgress";

describe("useSearchProgress utilities", () => {
  describe("formatProgressStep", () => {
    it("removes technical prefixes", () => {
      expect(formatProgressStep("Analyzing company data")).toBe("company data");
      expect(formatProgressStep("Processing interview results")).toBe("interview results");
      expect(formatProgressStep("Generating questions")).toBe("questions");
      expect(formatProgressStep("Finalizing report")).toBe("report");
    });

    it("removes trailing ellipsis", () => {
      expect(formatProgressStep("Loading data...")).toBe("Loading data");
    });

    it("returns original string if stripping leaves empty", () => {
      expect(formatProgressStep("Analyzing")).toBe("Analyzing");
    });

    it("handles strings without prefixes", () => {
      expect(formatProgressStep("Building interview stages")).toBe(
        "Building interview stages",
      );
    });

    it("handles empty string", () => {
      expect(formatProgressStep("")).toBe("");
    });
  });

  describe("getProgressColor", () => {
    it("returns correct colors for each status", () => {
      expect(getProgressColor("pending")).toBe("text-yellow-600");
      expect(getProgressColor("processing")).toBe("text-blue-600");
      expect(getProgressColor("completed")).toBe("text-green-600");
      expect(getProgressColor("failed")).toBe("text-red-600");
    });

    it("returns gray for unknown status", () => {
      expect(getProgressColor("unknown" as any)).toBe("text-gray-600");
    });
  });

  describe("getProgressIcon", () => {
    it("returns correct icons for each status", () => {
      expect(getProgressIcon("pending")).toBe("\u23F3");
      expect(getProgressIcon("processing")).toBe("\uD83D\uDD04");
      expect(getProgressIcon("completed")).toBe("\u2705");
      expect(getProgressIcon("failed")).toBe("\u274C");
    });
  });
});
