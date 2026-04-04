import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProgressDialog from "../ProgressDialog";

const mockSearchProgressData = vi.fn();
const mockStallDetection = vi.fn();
const mockTimeEstimate = vi.fn();

vi.mock("@/hooks/useSearchProgress", () => ({
  useSearchProgress: () => ({
    data: mockSearchProgressData(),
    error: null,
  }),
  useSearchStallDetection: () => mockStallDetection(),
  useEstimatedCompletionTime: () => mockTimeEstimate(),
  formatProgressStep: (step: string) =>
    step.replace(/^(Analyzing|Processing|Evaluating|Generating|Finalizing)/, "").trim() || step,
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onViewResults: vi.fn(),
  searchId: "search-1",
  company: "Acme Corp",
  role: "Engineer",
};

describe("ProgressDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStallDetection.mockReturnValue({ isStalled: false, stalledSeconds: 0 });
    mockTimeEstimate.mockReturnValue(null);
  });

  it("renders nothing when isOpen is false", () => {
    mockSearchProgressData.mockReturnValue(null);

    const { container } = render(<ProgressDialog {...defaultProps} isOpen={false} />);
    expect(container.querySelector("[role='dialog']")).not.toBeInTheDocument();
  });

  it("shows company and role in the description", () => {
    mockSearchProgressData.mockReturnValue(null);

    render(<ProgressDialog {...defaultProps} />);

    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText(/Engineer/)).toBeInTheDocument();
  });

  it("shows pending state with initializing message", () => {
    mockSearchProgressData.mockReturnValue({
      status: "pending",
      progress_pct: 0,
      progress_step: "Initializing research...",
    });

    render(<ProgressDialog {...defaultProps} />);

    expect(screen.getByText("Queued and ready to start")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows processing state with current step", () => {
    mockSearchProgressData.mockReturnValue({
      status: "processing",
      progress_pct: 45,
      progress_step: "Building interview stages",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(<ProgressDialog {...defaultProps} />);

    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("shows completed state with view results button", () => {
    mockSearchProgressData.mockReturnValue({
      status: "completed",
      progress_pct: 100,
      progress_step: "Done",
    });

    render(<ProgressDialog {...defaultProps} />);

    expect(screen.getByText("Research complete")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View results" })).toBeInTheDocument();
    // There's also a dialog close X button, so use getAllByRole
    const closeButtons = screen.getAllByRole("button", { name: /Close/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows failed state with error message", () => {
    mockSearchProgressData.mockReturnValue({
      status: "failed",
      progress_pct: 30,
      progress_step: "Error",
      error_message: "API rate limit exceeded",
    });

    render(<ProgressDialog {...defaultProps} />);

    expect(screen.getByText("Research failed: API rate limit exceeded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View research progress" })).toBeInTheDocument();
  });

  it("shows stall warning when research is stuck", () => {
    mockSearchProgressData.mockReturnValue({
      status: "processing",
      progress_pct: 25,
      progress_step: "Collecting sources",
      started_at: new Date().toISOString(),
      updated_at: new Date(Date.now() - 60000).toISOString(),
    });
    mockStallDetection.mockReturnValue({ isStalled: true, stalledSeconds: 30 });

    render(<ProgressDialog {...defaultProps} />);

    expect(screen.getByText(/slower than usual/)).toBeInTheDocument();
  });

  it("renders all three progress stages", () => {
    mockSearchProgressData.mockReturnValue({
      status: "processing",
      progress_pct: 10,
      progress_step: "Collecting data",
    });

    render(<ProgressDialog {...defaultProps} />);

    expect(screen.getByText("Collecting sources")).toBeInTheDocument();
    expect(screen.getByText("Building interview stages")).toBeInTheDocument();
    expect(screen.getByText("Preparing practice")).toBeInTheDocument();
  });

  it("shows safe-to-leave message", () => {
    mockSearchProgressData.mockReturnValue(null);

    render(<ProgressDialog {...defaultProps} />);

    expect(screen.getByText(/Safe to leave this screen/)).toBeInTheDocument();
  });
});
