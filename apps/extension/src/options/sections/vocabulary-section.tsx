import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "salto-src/components/ui/alert";
import { Button } from "salto-src/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "salto-src/components/ui/field";
import { Separator } from "salto-src/components/ui/separator";

import { browserMessageClient } from "salto-src/selection/message-client";

type FailedItem = {
  vocabularyItemId: string;
  term: string;
  fields: string[];
};

export function VocabularySection() {
  const [items, setItems] = useState<FailedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const response = await browserMessageClient.send({ type: "list-failed-enrichment" });
    if (response.ok && response.type === "list-failed-enrichment") {
      setItems(response.data.items as FailedItem[]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const retry = async (vocabularyItemId?: string) => {
    setLoading(true);
    try {
      await browserMessageClient.send({
        type: "retry-enrichment",
        payload: vocabularyItemId ? { vocabularyItemId } : undefined
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-label="词汇管理"
      className="flex flex-col gap-5 py-6"
      data-od-id="vocabulary-section"
    >
      {items.length === 0 ? (
        <Alert role="note">
          <AlertTitle>没有失败的字段</AlertTitle>
          <AlertDescription>
            所有词汇字段均已就绪，无需重试。
          </AlertDescription>
        </Alert>
      ) : (
        <FieldGroup className="gap-0">
          {items.map((item, index) => (
            <div className="contents" key={item.vocabularyItemId}>
              {index > 0 ? <Separator /> : null}
              <Field
                className="min-h-16 items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                orientation="responsive"
              >
                <FieldContent className="min-w-0">
                  <FieldTitle>{item.term}</FieldTitle>
                  <FieldDescription>
                    失败字段：{item.fields.join("、")}
                  </FieldDescription>
                </FieldContent>
                <Button
                  disabled={loading}
                  onClick={() => retry(item.vocabularyItemId)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  重试
                </Button>
              </Field>
            </div>
          ))}
        </FieldGroup>
      )}
      {items.length > 0 ? (
        <Button
          className="w-fit"
          disabled={loading}
          onClick={() => retry()}
          type="button"
        >
          重试全部
        </Button>
      ) : null}
    </section>
  );
}
