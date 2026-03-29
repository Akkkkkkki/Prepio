import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommandDialog } from "../command";

describe("CommandDialog", () => {
  it("renders hidden dialog metadata for accessibility", () => {
    render(
      <CommandDialog open onOpenChange={() => {}}>
        <div>Palette content</div>
      </CommandDialog>,
    );

    expect(screen.getByText("Command menu")).toBeInTheDocument();
    expect(screen.getByText("Search and run available commands.")).toBeInTheDocument();
  });
});
