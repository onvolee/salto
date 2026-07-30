import type { CSSProperties, ReactNode } from "react";

import type { DictionaryExample } from "@salto/core";

import { cn } from "salto-src/lib/utils";

export type TranslationFieldStyles = ReadonlyMap<string, {
  readonly key: CSSProperties;
  readonly value: CSSProperties;
}>;

export function TranslationFieldValue({
  style,
  value,
}: {
  readonly style?: CSSProperties;
  readonly value: string | readonly string[] | readonly DictionaryExample[];
}) {
  if (typeof value === "string") {
    return <span className="salto-translation-field-list__text" style={style}>{value}</span>;
  }

  if (value.length > 0 && typeof value[0] === "object") {
    return (
      <ol className="salto-translation-field-list__examples" role="list">
        {(value as readonly DictionaryExample[]).map((example, index) => (
          <li
            className="salto-translation-field-list__example"
            key={`${index}:${example.english}:${example.source ?? ""}`}
          >
            <p className="salto-translation-field-list__example-english" lang="en">
              {example.english}
            </p>
            {example.chinese ? (
              <p className="salto-translation-field-list__example-chinese" lang="zh-CN">
                {example.chinese}
              </p>
            ) : null}
            {example.source ? (
              <cite className="salto-translation-field-list__example-source">
                《{example.source}》
              </cite>
            ) : null}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="salto-translation-field-list__items" role="list">
      {(value as readonly string[]).map((item, index) => (
        <li key={`${index}:${item}`} style={style}>{item}</li>
      ))}
    </ul>
  );
}

export function TranslationFieldList({
  className,
  fieldStyles,
  renderValue,
  schema,
}: {
  readonly className?: string;
  readonly fieldStyles: TranslationFieldStyles;
  readonly renderValue: (fieldId: string, valueStyle?: CSSProperties) => ReactNode;
  readonly schema: readonly { readonly id: string; readonly label: string }[];
}) {
  return (
    <div className={cn("salto-translation-field-list", className)}>
      <dl>
        {schema.map((field) => {
          const styles = fieldStyles.get(field.id);
          return (
            <div className="salto-translation-field-list__field" key={field.id}>
              <dt style={styles?.key}>{field.label}</dt>
              <dd>{renderValue(field.id, styles?.value)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
