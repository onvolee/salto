// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Switch } from "./switch";

afterEach(cleanup);

describe("Switch", () => {
  it.each([false, true])(
    "keeps the thumb white when checked is %s",
    (checked) => {
      const { container } = render(
        <Switch checked={checked} aria-label="Theme-independent switch" />,
      );

      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        String(checked),
      );

      const thumb = container.querySelector('[data-slot="switch-thumb"]');
      expect(thumb).toHaveClass("bg-primary-foreground");
      expect(thumb?.className).not.toContain("dark:");
    },
  );
});
