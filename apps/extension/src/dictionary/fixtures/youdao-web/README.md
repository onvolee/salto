# Youdao Web fixtures

These fixtures are minimized, synthetic, and contain no cookies, account data, request
headers, scripts, or unrelated page content. Their DOM structure was observed from the
public `https://dict.youdao.com/w/eng/example/` page on 2026-07-19. Lexical values are
small test examples rather than archived live responses.

Provider selectors are intentionally isolated to the `youdao-web` adapter. A selector
change should fail the malformed fixture with `parser-failure` instead of returning
partially misidentified page content.
