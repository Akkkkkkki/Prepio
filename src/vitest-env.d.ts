// `vitest.setup.ts` imports `@testing-library/jest-dom/vitest` at runtime, but
// it lives outside `tsconfig.app.json`'s `include: ["src"]`, so its `Assertion`
// augmentation was never visible when typechecking the app. That made every
// `toBeInTheDocument` / `toHaveAttribute` assertion a phantom TS2339 in the
// legacy error backlog. Referencing the types from inside `src` loads the
// augmentation for the app project too.
/// <reference types="@testing-library/jest-dom/vitest" />
