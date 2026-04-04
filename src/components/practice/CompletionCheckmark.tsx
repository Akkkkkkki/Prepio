import { useEffect, useState } from "react";

interface CompletionCheckmarkProps {
  visible: boolean;
  duration?: number;
}

export const CompletionCheckmark = ({ visible, duration = 800 }: CompletionCheckmarkProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShow(false);
      return;
    }

    setShow(true);
    const timer = setTimeout(() => setShow(false), duration);
    return () => clearTimeout(timer);
  }, [visible, duration]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        className="drop-shadow-lg"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="hsl(var(--success))"
          strokeWidth="2"
          strokeDasharray="60"
          strokeDashoffset="60"
          style={{ animation: "checkmark-circle-draw 240ms var(--motion-ease-out) forwards" }}
        />
        <path
          d="M8 12.5l2.5 2.5 5-5"
          stroke="hsl(var(--success))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="24"
          strokeDashoffset="24"
          style={{ animation: "checkmark-draw 240ms var(--motion-ease-out) 120ms forwards" }}
        />
      </svg>
    </div>
  );
};
