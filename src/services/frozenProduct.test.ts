import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchService } from "./searchService";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
describe("frozen provider paths", () => {
  beforeEach(() => vi.clearAllMocks());
  it("blocks the old guest research method before any Edge Function call", async () => {
    expect(await searchService.createResearchPreview({ company: "Synthetic company" })).toMatchObject({ success: false });
    expect(invoke).not.toHaveBeenCalled();
  });
  it("blocks paid feedback even for a direct caller", async () => {
    expect(await searchService.generateAnswerFeedback("synthetic-answer", true)).toMatchObject({ success: false });
    expect(invoke).not.toHaveBeenCalled();
  });
});
