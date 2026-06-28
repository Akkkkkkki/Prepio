import { describe, expect, it } from "vitest";

import { createEmptyCandidateProfile } from "@/lib/candidateProfile";

import { buildProfileExportPayload, buildProfilePdfHtml } from "./accountExport";

describe("account export helpers", () => {
  it("builds a JSON export payload with account email and candidate profile", () => {
    const profile = createEmptyCandidateProfile("user-1");

    const payload = buildProfileExportPayload(profile, "test@example.com");

    expect(payload.account).toEqual({ email: "test@example.com" });
    expect(payload.candidateProfile.userId).toBe("user-1");
    expect(new Date(payload.exportedAt).toString()).not.toBe("Invalid Date");
  });

  it("escapes profile content in the PDF print HTML", () => {
    const profile = {
      ...createEmptyCandidateProfile("user-1"),
      headline: "<Senior PM>",
      summary: "Owned <script>alert('x')</script>",
    };

    const html = buildProfilePdfHtml(profile, "test@example.com");

    expect(html).toContain("&lt;Senior PM&gt;");
    expect(html).toContain("&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt;");
    expect(html).not.toContain("<Senior PM>");
  });
});
