// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  TranslationFieldList,
  TranslationFieldValue,
} from "./translation-field-list";

describe("translation field value", () => {
  afterEach(cleanup);

  it("applies Value CSS from the field to a text value and every list item", () => {
    const style = { backgroundColor: "rgb(1, 2, 3)", padding: "4px" };
    const fieldStyles = new Map([
      ["result", { key: {}, value: style }],
    ]);
    const rendered = render(
      <TranslationFieldList
        fieldStyles={fieldStyles}
        renderValue={(_, valueStyle) => (
          <TranslationFieldValue style={valueStyle} value="Single result" />
        )}
        schema={[{ id: "result", label: "Result" }]}
      />,
    );

    expect(screen.getByText("Single result")).toHaveStyle(style);

    rendered.rerender(
      <TranslationFieldList
        fieldStyles={fieldStyles}
        renderValue={(_, valueStyle) => (
          <TranslationFieldValue
            style={valueStyle}
            value={["First result", "Second result"]}
          />
        )}
        schema={[{ id: "result", label: "Result" }]}
      />,
    );

    expect(screen.getByText("First result")).toHaveStyle(style);
    expect(screen.getByText("Second result")).toHaveStyle(style);
    expect(screen.getByRole("list")).not.toHaveAttribute("style");
  });
});
