import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("browser state hooks", () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });

  it("tracks online and offline events", async () => {
    let onlineState = true;

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => onlineState,
    });

    const { useNetworkStatus } = await import("../useNetworkStatus");

    const NetworkProbe = () => {
      const { isOffline } = useNetworkStatus();
      return <div>{isOffline ? "offline" : "online"}</div>;
    };

    render(<NetworkProbe />);

    expect(screen.getByText("online")).toBeInTheDocument();

    onlineState = false;
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => {
      expect(screen.getByText("offline")).toBeInTheDocument();
    });

    onlineState = true;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.getByText("online")).toBeInTheDocument();
    });
  });

  it("exposes the install prompt only after beforeinstallprompt fires", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const userChoice = Promise.resolve({
      outcome: "accepted" as const,
      platform: "web",
    });

    const installEvent = new Event("beforeinstallprompt");
    Object.defineProperties(installEvent, {
      prompt: {
        configurable: true,
        value: prompt,
      },
      userChoice: {
        configurable: true,
        value: userChoice,
      },
    });

    const { useInstallPrompt } = await import("../useInstallPrompt");

    const InstallProbe = () => {
      const { canInstall, promptInstall } = useInstallPrompt();

      return (
        <>
          <div>{canInstall ? "ready" : "not-ready"}</div>
          <button type="button" onClick={() => void promptInstall()}>
            install
          </button>
        </>
      );
    };

    render(<InstallProbe />);

    expect(screen.getByText("not-ready")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(installEvent);
    });

    await waitFor(() => {
      expect(screen.getByText("ready")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "install" }));
    });

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledTimes(1);
      expect(screen.getByText("not-ready")).toBeInTheDocument();
    });
  });

  it("captures the install prompt even if the event fires before a component subscribes", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const userChoice = Promise.resolve({
      outcome: "accepted" as const,
      platform: "web",
    });

    const installEvent = new Event("beforeinstallprompt");
    Object.defineProperties(installEvent, {
      prompt: {
        configurable: true,
        value: prompt,
      },
      userChoice: {
        configurable: true,
        value: userChoice,
      },
    });

    const { useInstallPrompt } = await import("../useInstallPrompt");

    await act(async () => {
      window.dispatchEvent(installEvent);
    });

    const InstallProbe = () => {
      const { canInstall } = useInstallPrompt();
      return <div>{canInstall ? "ready" : "not-ready"}</div>;
    };

    render(<InstallProbe />);

    await waitFor(() => {
      expect(screen.getByText("ready")).toBeInTheDocument();
    });
  });
});
