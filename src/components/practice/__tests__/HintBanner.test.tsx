import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HintBanner } from "../HintBanner";

describe("HintBanner", () => {
  it("does not point at voice recording while voice is frozen", () => {
    render(<HintBanner onDismiss={vi.fn()} />);

    expect(screen.queryByText(/Record for a full answer/)).not.toBeInTheDocument();
    expect(screen.getByText("Type your answer or quick bullets")).toBeInTheDocument();
  });
});
