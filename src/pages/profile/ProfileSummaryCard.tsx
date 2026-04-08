import { Link } from "react-router-dom";
import { Link2, MapPin, Sparkles, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { CandidateProfile } from "@/lib/candidateProfile";
import { createEmptyProfileLink } from "@/lib/candidateProfile";

import {
  formatResumeLabel,
  removeArrayItem,
  updateArrayItem,
  type ResumeVersion,
} from "./profileUtils";

interface ProfileSummaryCardProps {
  activeImportCreatedAt?: string | null;
  activeResume: ResumeVersion | null;
  profile: CandidateProfile;
  updateProfile: (nextProfile: CandidateProfile) => void;
}

const ProfileSummaryCard = ({
  activeImportCreatedAt,
  activeResume,
  profile,
  updateProfile,
}: ProfileSummaryCardProps) => (
  <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-background via-background to-muted/30">
    <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.7fr)_280px]">
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="profile-headline">Headline</Label>
            <Input
              id="profile-headline"
              value={profile.headline}
              onChange={(event) => updateProfile({ ...profile, headline: event.target.value })}
              placeholder="Staff product leader building category-defining software"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-location">Location</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="profile-location"
                className="pl-9"
                value={profile.location}
                onChange={(event) => updateProfile({ ...profile, location: event.target.value })}
                placeholder="London, UK"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Links</Label>
              <p className="text-xs text-muted-foreground">
                Keep the public proof points that support your profile.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                updateProfile({
                  ...profile,
                  links: [...profile.links, createEmptyProfileLink()],
                })
              }
            >
              <Link2 className="h-4 w-4" />
              Add link
            </Button>
          </div>

          {profile.links.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Add LinkedIn, portfolio, GitHub, talks, or case studies here.
            </div>
          ) : (
            <div className="space-y-3">
              {profile.links.map((link, index) => (
                <div
                  key={link.id}
                  className="grid gap-3 rounded-2xl border border-border/70 p-4 md:grid-cols-[1fr_1.8fr_auto]"
                >
                  <Input
                    value={link.label}
                    onChange={(event) =>
                      updateProfile({
                        ...profile,
                        links: updateArrayItem(
                          profile.links,
                          index,
                          createEmptyProfileLink({ ...link, label: event.target.value }),
                        ),
                      })
                    }
                    placeholder="LinkedIn"
                  />
                  <Input
                    value={link.url}
                    onChange={(event) =>
                      updateProfile({
                        ...profile,
                        links: updateArrayItem(
                          profile.links,
                          index,
                          createEmptyProfileLink({ ...link, url: event.target.value }),
                        ),
                      })
                    }
                    placeholder="https://example.com"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${link.label || "link"}`}
                    onClick={() =>
                      updateProfile({
                        ...profile,
                        links: removeArrayItem(profile.links, index),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-border/70 bg-background/90 p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Profile completeness</p>
            <Badge variant="secondary">{profile.completionScore}%</Badge>
          </div>
          <Progress value={profile.completionScore} />
          <p className="text-xs text-muted-foreground">
            Keep this profile concise and import operational flows only when needed.
          </p>
        </div>

        <div className="space-y-2 rounded-2xl bg-muted/40 p-4 text-sm">
          <p className="font-medium">Current source</p>
          <p className="text-muted-foreground">{formatResumeLabel(activeResume)}</p>
          <p className="text-xs text-muted-foreground">
            {activeImportCreatedAt ? `Pending import from ${new Date(activeImportCreatedAt).toLocaleDateString()}` : "No pending import"}
          </p>
        </div>

        {activeImportCreatedAt ? (
          <Button asChild variant="outline" className="w-full justify-between">
            <Link to="/profile/import">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Review pending import
              </span>
              <Upload className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </CardContent>
  </Card>
);

export default ProfileSummaryCard;
