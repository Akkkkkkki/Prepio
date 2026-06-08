import { act, render } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useMobileFooterHeight } from "@/hooks/useMobileFooterHeight";

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn(() => {
    this.callback([], this as unknown as ResizeObserver);
  });

  unobserve = vi.fn();

  disconnect = vi.fn();

  static triggerAll() {
    for (const instance of MockResizeObserver.instances) {
      instance.callback([], instance as unknown as ResizeObserver);
    }
  }

  static reset() {
    MockResizeObserver.instances = [];
  }
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

beforeEach(() => {
  MockResizeObserver.reset();
});

function Harness({
  enabled,
  height,
  onResult,
}: {
  enabled: boolean;
  height: number;
  onResult: (result: { height: number }) => void;
}) {
  const { height: measured, setRef } = useMobileFooterHeight(enabled);
  onResult({ height: measured });
  return (
    <div
      ref={(node) => {
        if (node) {
          Object.defineProperty(node, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
              height,
              width: 0,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              x: 0,
              y: 0,
              toJSON: () => ({}),
            }),
          });
        }
        setRef(node as HTMLDivElement | null);
      }}
    />
  );
}

describe("useMobileFooterHeight", () => {
  it("measures the element height when enabled and rounds up fractional values", () => {
    const results: number[] = [];
    render(
      <Harness
        enabled
        height={63.4}
        onResult={({ height }) => {
          results.push(height);
        }}
      />,
    );

    expect(results.at(-1)).toBe(64);
    expect(MockResizeObserver.instances).toHaveLength(1);
  });

  it("returns 0 and skips observation while disabled", () => {
    const results: number[] = [];
    render(
      <Harness
        enabled={false}
        height={120}
        onResult={({ height }) => {
          results.push(height);
        }}
      />,
    );

    expect(results.at(-1)).toBe(0);
    expect(MockResizeObserver.instances).toHaveLength(0);
  });

  it("disconnects the observer when disabled after being enabled", () => {
    const results: number[] = [];
    const { rerender } = render(
      <Harness
        enabled
        height={48}
        onResult={({ height }) => {
          results.push(height);
        }}
      />,
    );

    expect(results.at(-1)).toBe(48);
    const observer = MockResizeObserver.instances[0];
    expect(observer.disconnect).not.toHaveBeenCalled();

    act(() => {
      rerender(
        <Harness
          enabled={false}
          height={48}
          onResult={({ height }) => {
            results.push(height);
          }}
        />,
      );
    });

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(results.at(-1)).toBe(0);
  });

  it("remeasures on ResizeObserver callbacks", () => {
    const heights = [40, 80];
    let current = 0;
    const results: number[] = [];

    function Resizer({ onResult }: { onResult: (height: number) => void }) {
      const { height, setRef } = useMobileFooterHeight(true);
      onResult(height);
      return (
        <div
          ref={(node) => {
            if (node) {
              Object.defineProperty(node, "getBoundingClientRect", {
                configurable: true,
                value: () => ({
                  height: heights[current],
                  width: 0,
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  x: 0,
                  y: 0,
                  toJSON: () => ({}),
                }),
              });
            }
            setRef(node as HTMLDivElement | null);
          }}
        />
      );
    }

    render(<Resizer onResult={(height) => results.push(height)} />);
    expect(results.at(-1)).toBe(40);

    current = 1;
    act(() => {
      MockResizeObserver.triggerAll();
    });

    expect(results.at(-1)).toBe(80);
  });
});
