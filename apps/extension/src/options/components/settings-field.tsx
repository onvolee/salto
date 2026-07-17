import type { ReactNode } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "salto-src/components/ui/field";
import { cn } from "salto-src/lib/utils";

type SettingsFieldProps = {
  children: ReactNode;
  controlClassName?: string;
  description: string;
  htmlFor?: string;
  id: string;
  title: string;
};

export function SettingsField({
  children,
  controlClassName,
  description,
  htmlFor,
  id,
  title,
}: SettingsFieldProps) {
  const labelId = `${id}-label`;

  return (
    <Field
      className="min-h-16 items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
      orientation="responsive"
    >
      <FieldContent className="min-w-0">
        {htmlFor ? (
          <FieldLabel htmlFor={htmlFor} id={labelId}>
            {title}
          </FieldLabel>
        ) : (
          <FieldTitle id={labelId}>{title}</FieldTitle>
        )}
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <div className={cn("w-full sm:max-w-lg", controlClassName)}>
        {children}
      </div>
    </Field>
  );
}
