import type { CSSProperties, ReactNode } from "react";

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
  readonly value: string | readonly string[];
}) {
  if (typeof value === "string") {
    return <span style={style}>{value}</span>;
  }

  return (
    <ul className="salto-translation-field-list__items">
      {value.map((item, index) => (
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
