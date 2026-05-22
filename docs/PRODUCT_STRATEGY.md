# Product Strategy

## Positioning

Prepio helps candidates prepare for a specific interview, not generic interview practice.

The wedge is research-first prep: company evidence, role expectations, resume context, likely stages, and tailored questions in one flow.

## Target User

Candidates with an active interview loop who need useful prep quickly:

- they know the company and role
- they may have a job description or links
- they have a resume/CV
- they want targeted practice, not a question bank

## Current Product Promise

Prepio should answer:

- What is this company likely to test?
- Which parts of my background matter most?
- What questions should I practice first?
- What would a strong answer include?
- What did I already practice, and where am I weak?

## What Is Working

- The research pipeline creates a differentiated prep artifact.
- Guest preview gives cold visitors a faster value signal.
- Resume/profile import reduces setup work.
- Practice has persistence: notes, saved answers, audio transcripts, flags, self-ratings, and history.
- Billing infrastructure is now present enough to build paid gates on top.

## Monetization Decision

Use subscriptions.

Default plan shape:

- Free: research and practice path with clear limits.
- Monthly: paid AI feedback and higher usage.
- Quarterly: interview-season plan.
- Annual: ongoing career-prep plan.

Stripe is the billing system. The webhook, subscription tables, and entitlement resolver exist. The remaining product work is the pricing surface, Checkout/Portal session creation, and paid-gate UX.

## Paid Feature

AI answer feedback is the anchor paid feature.

- Free users can practice and save answers.
- Free users must not trigger feedback generation.
- Paid users get structured coaching on submitted answers.
- Feedback data should later power readiness and progress reporting.

## Near-Term Priorities

1. Paid AI answer feedback.
2. Pricing, Checkout, Portal, and upgrade prompts.
3. Public landing/conversion improvements using guest preview.
4. Feedback-based readiness and progress reporting.

## Explicit Non-Priorities

- Real-time conversational interviews.
- Speech-pattern scoring.
- Browser extension or ATS import.
- Team/enterprise packaging.
- SEO content engine.

These are valid later bets, but they should not distract from targeted prep and paid feedback.

## Current Limitations

- No AI answer feedback yet.
- Billing backend exists, but users cannot buy or manage subscriptions in-app yet.
- Practice audio is uploaded and transcribed, but there is no AI coaching on the answer yet.
- No lifecycle notifications.
- English-first research and generation.
