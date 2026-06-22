import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Calendar } from "./calendar";

describe("Calendar", () => {
  it("renders the accessible v9 month navigation controls", () => {
    const { container } = render(<Calendar defaultMonth={new Date(2026, 0, 1)} />);

    expect(
      screen.getByRole("button", { name: "Go to the Previous Month" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to the Next Month" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".lucide-chevron-left")).toBeInTheDocument();
    expect(container.querySelector(".lucide-chevron-right")).toBeInTheDocument();
  });
});
