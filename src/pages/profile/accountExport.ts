import type { CandidateProfile } from "@/lib/candidateProfile";

export const buildProfileExportPayload = (
  profile: CandidateProfile,
  email: string | null | undefined,
) => ({
  exportedAt: new Date().toISOString(),
  account: {
    email: email ?? null,
  },
  candidateProfile: profile,
});

export const downloadJsonFile = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const renderList = (items: string[]) =>
  items.length > 0
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>None saved.</p>";

export const buildProfilePdfHtml = (
  profile: CandidateProfile,
  email: string | null | undefined,
) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Prepio profile export</title>
    <style>
      body { color: #111827; font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 40px; }
      h1 { font-size: 28px; margin: 0 0 4px; }
      h2 { border-bottom: 1px solid #d1d5db; font-size: 16px; margin-top: 28px; padding-bottom: 6px; }
      h3 { font-size: 14px; margin: 18px 0 4px; }
      p { margin: 4px 0 10px; }
      ul { margin: 6px 0 12px 20px; padding: 0; }
      .muted { color: #6b7280; }
      .item { break-inside: avoid; margin-bottom: 14px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(profile.headline || "Candidate profile")}</h1>
    <p class="muted">${escapeHtml(email ?? "No account email saved")} · ${escapeHtml(profile.location || "No location saved")}</p>
    <h2>Summary</h2>
    <p>${escapeHtml(profile.summary || "No summary saved.")}</p>
    <h2>Experience</h2>
    ${
      profile.experiences.length
        ? profile.experiences.map((experience) => `
          <section class="item">
            <h3>${escapeHtml(experience.title || "Untitled role")} · ${escapeHtml(experience.company || "Unknown company")}</h3>
            <p class="muted">${escapeHtml([experience.startDate, experience.endDate || (experience.current ? "Present" : "")].filter(Boolean).join(" - "))}</p>
            <p>${escapeHtml(experience.summary || "")}</p>
            ${renderList(experience.bullets.map((bullet) => bullet.text))}
          </section>
        `).join("")
        : "<p>None saved.</p>"
    }
    <h2>Projects</h2>
    ${
      profile.projects.length
        ? profile.projects.map((project) => `
          <section class="item">
            <h3>${escapeHtml(project.title || "Untitled project")}</h3>
            <p>${escapeHtml(project.context || "")}</p>
            ${renderList(project.bullets.map((bullet) => bullet.text))}
          </section>
        `).join("")
        : "<p>None saved.</p>"
    }
    <h2>Skills</h2>
    ${
      profile.skills.length
        ? profile.skills.map((group) => `
          <section class="item">
            <h3>${escapeHtml(group.name || "Skills")}</h3>
            ${renderList(group.skills)}
          </section>
        `).join("")
        : "<p>None saved.</p>"
    }
    <h2>Preferences</h2>
    <p>${escapeHtml(profile.preferences.notes || "No preference notes saved.")}</p>
  </body>
</html>
`;

export const openProfilePdfPrintView = (
  profile: CandidateProfile,
  email: string | null | undefined,
) => {
  const popup = window.open("", "_blank");

  if (!popup) {
    throw new Error("Browser blocked the PDF export window.");
  }

  popup.document.open();
  popup.document.write(buildProfilePdfHtml(profile, email));
  popup.document.close();
  popup.focus();
  popup.print();
};
