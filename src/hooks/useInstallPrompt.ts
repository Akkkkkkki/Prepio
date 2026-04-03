import { useSyncExternalStore } from "react";

type InstallPromptOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: InstallPromptOutcome;
    platform: string;
  }>;
}

type InstallPromptSnapshot = {
  canInstall: boolean;
  isInstalled: boolean;
};

const INSTALL_DISMISSED_SESSION_KEY = "prepio:install-dismissed:v1";

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let installSnapshot: InstallPromptSnapshot = {
  canInstall: false,
  isInstalled: false,
};

const subscribers = new Set<() => void>();
let removeListeners: (() => void) | null = null;

const isBrowserInstalled = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const isStandaloneDisplayMode = window.matchMedia?.("(display-mode: standalone)").matches;
  const isIosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );

  return Boolean(isStandaloneDisplayMode || isIosStandalone);
};

const isDismissedForSession = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(INSTALL_DISMISSED_SESSION_KEY) === "true";
  } catch {
    return false;
  }
};

const setDismissedForSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(INSTALL_DISMISSED_SESSION_KEY, "true");
  } catch {
    return;
  }
};

const clearDismissedForSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(INSTALL_DISMISSED_SESSION_KEY);
  } catch {
    return;
  }
};

const emitChange = () => {
  subscribers.forEach((listener) => listener());
};

const computeSnapshot = (): InstallPromptSnapshot => {
  const isInstalled = isBrowserInstalled();
  const canInstall = !isInstalled && !isDismissedForSession() && Boolean(deferredInstallPrompt);

  return {
    canInstall,
    isInstalled,
  };
};

const updateSnapshot = (shouldEmit: boolean) => {
  const nextSnapshot = computeSnapshot();

  if (
    installSnapshot.isInstalled === nextSnapshot.isInstalled &&
    installSnapshot.canInstall === nextSnapshot.canInstall
  ) {
    return;
  }

  installSnapshot = nextSnapshot;

  if (shouldEmit) {
    emitChange();
  }
};

const ensureListeners = () => {
  if (removeListeners || typeof window === "undefined") {
    return;
  }

  updateSnapshot(false);

  const handleBeforeInstallPrompt = (event: Event) => {
    const promptEvent = event as BeforeInstallPromptEvent;
    promptEvent.preventDefault();
    deferredInstallPrompt = promptEvent;
    updateSnapshot(true);
  };

  const handleAppInstalled = () => {
    deferredInstallPrompt = null;
    clearDismissedForSession();
    updateSnapshot(true);
  };

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
  window.addEventListener("appinstalled", handleAppInstalled);

  removeListeners = () => {
    window.removeEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener,
    );
    window.removeEventListener("appinstalled", handleAppInstalled);
    removeListeners = null;
  };
};

const subscribe = (listener: () => void) => {
  ensureListeners();
  updateSnapshot(false);
  subscribers.add(listener);

  return () => {
    subscribers.delete(listener);
  };
};

const getSnapshot = () => {
  updateSnapshot(false);
  return installSnapshot;
};

const getServerSnapshot = (): InstallPromptSnapshot => ({
  canInstall: false,
  isInstalled: false,
});

const promptInstall = async () => {
  if (!deferredInstallPrompt) {
    return false;
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;

  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome === "dismissed") {
      setDismissedForSession();
    } else {
      clearDismissedForSession();
    }

    updateSnapshot(true);
    return choice.outcome === "accepted";
  } catch {
    setDismissedForSession();
    updateSnapshot(true);
    return false;
  }
};

export const useInstallPrompt = () => {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    ...snapshot,
    promptInstall,
  };
};

if (typeof window !== "undefined") {
  ensureListeners();
}
