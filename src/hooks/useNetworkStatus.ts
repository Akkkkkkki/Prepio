import { useSyncExternalStore } from "react";

type NetworkStatusSnapshot = {
  isOnline: boolean;
  isOffline: boolean;
};

const getCurrentOnlineState = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

let networkSnapshot: NetworkStatusSnapshot = {
  isOnline: getCurrentOnlineState(),
  isOffline: !getCurrentOnlineState(),
};

const subscribers = new Set<() => void>();
let removeListeners: (() => void) | null = null;

const emitChange = () => {
  subscribers.forEach((listener) => listener());
};

const setSnapshot = (isOnline: boolean, shouldEmit: boolean) => {
  if (networkSnapshot.isOnline === isOnline) {
    return;
  }

  networkSnapshot = {
    isOnline,
    isOffline: !isOnline,
  };

  if (shouldEmit) {
    emitChange();
  }
};

const updateSnapshot = (isOnline: boolean) => {
  setSnapshot(isOnline, true);
};

const ensureListeners = () => {
  if (removeListeners || typeof window === "undefined") {
    return;
  }

  setSnapshot(getCurrentOnlineState(), false);

  const handleOnline = () => updateSnapshot(true);
  const handleOffline = () => updateSnapshot(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  removeListeners = () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    removeListeners = null;
  };
};

const subscribe = (listener: () => void) => {
  ensureListeners();
  subscribers.add(listener);

  return () => {
    subscribers.delete(listener);

    if (subscribers.size === 0) {
      removeListeners?.();
    }
  };
};

const getSnapshot = () => {
  setSnapshot(getCurrentOnlineState(), false);
  return networkSnapshot;
};

const getServerSnapshot = (): NetworkStatusSnapshot => ({
  isOnline: true,
  isOffline: false,
});

export const useNetworkStatus = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
