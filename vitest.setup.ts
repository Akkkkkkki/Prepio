import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { vi } from "vitest";

// Testing Library's 1s default for findBy*/waitFor is tight for the Practice suite on a
// loaded CI runner: starting a session renders a large tree behind async service mocks,
// and the wait expires before the first post-start control appears. Only the ceiling
// moves — assertions still resolve as soon as the DOM settles.
configure({ asyncUtilTimeout: 5000 });

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "test-publishable-key");

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? false : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const localStorageState = new Map<string, string>();

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageState.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageState.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageState.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageState.clear();
  }),
  key: vi.fn((index: number) => Array.from(localStorageState.keys())[index] ?? null),
  get length() {
    return localStorageState.size;
  },
};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorageMock,
});

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageMock,
});
