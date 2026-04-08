import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList, RotateCcw, Search } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchService } from "@/services/searchService";
import { useSearchHistory } from "@/hooks/useSearchHistory";

type PracticeSessionHistoryItem = {
  id: string;
  search_id: string;
  started_at: string;
  completed_at?: string | null;
  session_notes?: string | null;
  searches?: {
    company?: string | null;
    role?: string | null;
    country?: string | null;
  } | null;
};

const HISTORY_ALL_VALUE = "all";

const formatDateTime = (dateValue?: string | null) => {
  if (!dateValue) return "In progress";
  return new Date(dateValue).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const History = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState<PracticeSessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: searchHistory = [] } = useSearchHistory(true);

  const selectedSearchId = searchParams.get("searchId") ?? HISTORY_ALL_VALUE;

  useEffect(() => {
    let isActive = true;

    const loadSessions = async () => {
      setIsLoading(true);
      setError(null);

      const result = await searchService.getPracticeSessions(
        selectedSearchId === HISTORY_ALL_VALUE ? undefined : selectedSearchId,
      );

      if (!isActive) return;

      if (!result.success) {
        setError("Failed to load practice history.");
      } else {
        setSessions((result.sessions as PracticeSessionHistoryItem[]) ?? []);
      }

      setIsLoading(false);
    };

    loadSessions();

    return () => {
      isActive = false;
    };
  }, [selectedSearchId]);

  const filteredSessions = useMemo(() => {
    if (selectedSearchId === HISTORY_ALL_VALUE) return sessions;
    return sessions.filter((session) => session.search_id === selectedSearchId);
  }, [selectedSearchId, sessions]);

  const handleFilterChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === HISTORY_ALL_VALUE) {
      next.delete("searchId");
    } else {
      next.set("searchId", value);
    }
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation showSearchSelector={false} />
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <ClipboardList className="h-4 w-4" />
              Practice history
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Review your recent practice rounds</h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Jump back into a research run, or go straight to the questions you marked as needing another pass.
            </p>
          </div>

          <div className="w-full md:w-[280px]">
            <Select value={selectedSearchId} onValueChange={handleFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by research" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={HISTORY_ALL_VALUE}>All research</SelectItem>
                {searchHistory.map((search) => (
                  <SelectItem key={search.id} value={search.id}>
                    {search.company}
                    {search.role ? ` - ${search.role}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Practice sessions</p>
              <p className="mt-2 text-3xl font-semibold">{filteredSessions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Active filter</p>
              <p className="mt-2 text-lg font-semibold">
                {selectedSearchId === HISTORY_ALL_VALUE ? "All research" : "Single research run"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Fast path</p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to={selectedSearchId === HISTORY_ALL_VALUE ? "/dashboard" : `/practice?searchId=${selectedSearchId}&focus=needs_work`}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Practice flagged questions
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Loading practice history...</CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <p className="text-sm text-destructive">{error}</p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </CardContent>
            </Card>
          ) : filteredSessions.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>No practice sessions yet</CardTitle>
                <CardDescription>
                  Finish one practice round and it will show up here with a shortcut back into flagged questions.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link to={selectedSearchId === HISTORY_ALL_VALUE ? "/dashboard" : `/dashboard?searchId=${selectedSearchId}`}>
                    <Search className="mr-2 h-4 w-4" />
                    Open research dashboard
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={selectedSearchId === HISTORY_ALL_VALUE ? "/" : `/practice?searchId=${selectedSearchId}`}>
                    Start practice
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredSessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {session.searches?.company && <Badge variant="secondary">{session.searches.company}</Badge>}
                      {session.searches?.role && <Badge variant="outline">{session.searches.role}</Badge>}
                      {session.searches?.country && <Badge variant="outline">{session.searches.country}</Badge>}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Started {formatDateTime(session.started_at)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.completed_at ? `Completed ${formatDateTime(session.completed_at)}` : "Session still open"}
                      </p>
                    </div>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {session.session_notes || "No reflection saved for this round yet."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
                    <Button asChild>
                      <Link to={`/practice?searchId=${session.search_id}`}>Start another round</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to={`/practice?searchId=${session.search_id}&focus=needs_work`}>
                        Practice flagged questions
                      </Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link to={`/dashboard?searchId=${session.search_id}`}>Open dashboard</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
