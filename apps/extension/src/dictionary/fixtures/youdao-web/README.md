# Youdao Web fixtures

These fixtures are minimized, synthetic, and contain no cookies, account data, request
headers, scripts, or unrelated page content. Their DOM structures were observed from
public `https://dict.youdao.com/w/eng/{term}/` pages; fixtures that capture a later
provider variant record the observation date in a file comment. Lexical values are small
test examples rather than archived live responses.

Provider selectors are intentionally isolated to the `youdao-web` adapter. A selector
change should fail the malformed fixture with `parser-failure` instead of returning
partially misidentified page content.
