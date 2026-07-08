# Use Cambridge as a replaceable dictionary adapter

Salto MVP will use Cambridge page parsing as the first dictionary provider, but only behind a `DictionaryClient` adapter boundary. Core vocabulary and enrichment models must not depend on Cambridge-specific HTML, field names, or failure modes. This allows the MVP to ship with a practical dictionary source while keeping room to replace or add providers such as Youdao, Collins, or local dictionaries later.
