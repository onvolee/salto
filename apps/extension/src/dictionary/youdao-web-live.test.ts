import { expect, it } from "vitest";

import { createDictionaryClient } from "@salto/core";

import { createYoudaoWebAdapter, YOUDAO_PERMISSION_ORIGIN } from "./youdao-web-adapter";

const liveTest = process.env.SALTO_YOUDAO_LIVE_SMOKE === "1" ? it : it.skip;

liveTest("looks up only the approved live smoke word", async () => {
  const adapter = createYoudaoWebAdapter({
    async hasOriginPermission(origin) {
      expect(origin).toBe(YOUDAO_PERMISSION_ORIGIN);
      return true;
    }
  });

  const result = await createDictionaryClient(adapter).lookup(
    { term: "example", language: "en" },
    new AbortController().signal
  );

  expect(result.term).toBe("example");
  expect(result.fields.meaning.status).toBe("ready");
});
