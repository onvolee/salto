import { useRef, useState } from "react";

import { INITIAL_TRANSLATION_FIELDS } from "../data";

export function useTranslationFields() {
  const [fields, setFields] = useState(INITIAL_TRANSLATION_FIELDS);
  const nextFieldId = useRef(1);

  const addField = () => {
    const id = `custom-field-${nextFieldId.current}`;
    nextFieldId.current += 1;
    setFields((current) => [
      ...current,
      {
        id,
        label: "新字段",
        type: "文本",
        source: "AI 服务",
        description: "自定义翻译输出字段。",
        enabled: true,
      },
    ]);
  };

  const moveField = (from: number, to: number) => {
    setFields((current) => {
      if (from === to || from < 0 || to < 0 || to >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const toggleField = (id: string) => {
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, enabled: !field.enabled } : field,
      ),
    );
  };

  const renameField = (id: string) => {
    setFields((current) =>
      current.map((field) =>
        field.id === id && field.label === "新字段"
          ? { ...field, label: "自定义字段" }
          : field,
      ),
    );
  };

  const removeField = (id: string) => {
    setFields((current) => current.filter((field) => field.id !== id));
  };

  return {
    addField,
    fields,
    moveField,
    removeField,
    renameField,
    toggleField,
  };
}
