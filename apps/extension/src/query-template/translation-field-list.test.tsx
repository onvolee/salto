// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
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

  it("renders dictionary examples as fixed bilingual blocks", () => {
    render(
      <TranslationFieldValue
        style={{ display: "none" }}
        value={[
          {
            english: "Let me give you an example.",
            chinese: "让我来举一个例子吧。",
            source: "牛津词典",
          },
          {
            english: "She is a shining example to us all.",
            chinese: "她是我们所有人的光辉榜样。",
          },
        ]}
      />,
    );

    const examples = screen.getByRole("list");
    expect(within(examples).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Let me give you an example.")).toHaveAttribute("lang", "en");
    expect(screen.getByText("让我来举一个例子吧。")).toHaveAttribute("lang", "zh-CN");
    expect(screen.getByText("《牛津词典》").tagName).toBe("CITE");
    expect(examples).not.toHaveAttribute("style");
    expect(screen.getByText("She is a shining example to us all.").closest("li"))
      .not.toHaveTextContent("《");
  });

  it("preserves line breaks in text fields", () => {
    render(<TranslationFieldValue value={"n. 例子\nv. 举例说明"} />);

    expect(screen.getByText(/n\. 例子/)).toHaveClass("salto-translation-field-list__text");
  });
});
