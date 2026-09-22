import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Hand-written fictional example: no API, provider, clock, or user input needed.
const SAMPLE = [
  { stage: "Hiring manager", question: "Tell me about a product you shipped when the success metric was unclear.", focus: "Explain how you chose a measure, handled trade-offs, and checked the result." },
  { stage: "Product discussion", question: "A payments checkout has a high failure rate. How would you decide what to investigate first?", focus: "Separate customer impact from technical causes. Explain what evidence would change your decision." },
  { stage: "Team collaboration", question: "Describe a disagreement with an engineering partner and how you moved the work forward.", focus: "Make your own contribution clear and reflect on what you would do differently." },
];

export default function GuestSample() {
  const [showSample, setShowSample] = useState(false);
  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <Badge variant="secondary" className="w-fit">Free · Invite-only</Badge>
          <CardTitle asChild className="text-3xl"><h1>Prepare for your next interview</h1></CardTitle>
          <CardDescription className="text-base leading-7">
            Research a company and role, review your plan, practice in writing, and save your answers.
            Favorite questions or mark them as Needs-work, then return to your History.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Explore a fixed example below. Invited users can sign in to research their own interview.</p>
          <Button onClick={() => setShowSample(value => !value)} aria-expanded={showSample} aria-controls="guest-sample">
            {showSample ? "Hide sample plan" : "View sample plan"}
          </Button>
        </CardContent>
      </Card>
      {showSample && (
        <Card id="guest-sample">
          <CardHeader>
            <Badge variant="outline" className="w-fit">Illustrative sample</Badge>
            <CardTitle asChild><h2>Payments company · Product Manager</h2></CardTitle>
            <CardDescription>A fictional example of a prep plan. These are practice prompts, not verified questions from a particular employer. No live research runs when you open this sample.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {SAMPLE.map(item => (
              <section key={item.stage} className="rounded-2xl border p-4">
                <h3 className="text-sm font-medium text-muted-foreground">{item.stage}</h3>
                <p className="mt-2 font-semibold">{item.question}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.focus}</p>
              </section>
            ))}
            <Button asChild><Link to="/auth" state={{ from: { pathname: "/new-interview" } }}>Sign in to prepare your interview</Link></Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
