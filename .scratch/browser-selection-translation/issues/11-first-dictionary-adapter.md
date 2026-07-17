# 11 — 第一个字典适配器

**What to build:** 实现第一个字典适配器（youdao-web 或 cambridge-web），包含 HTML fixtures、DOM 解析器、超时和错误处理，达到稳定验收。

**Blocked by:** 10 — 字典客户端边界和契约

**Status:** ready-for-agent

- [ ] 选择第一个适配器：基于当前访问可靠性和固定词汇字段覆盖率选择 youdao-web 或 cambridge-web
- [ ] HTML fixtures：捕获代表性 HTML 或响应 fixtures，不包含用户特定 cookies 或凭据
- [ ] 常见词 fixture：包含常见词的 fixture
- [ ] 多词性 fixture：包含多个词性的 fixture
- [ ] 缺失字段 fixture：包含缺失字段的 fixture
- [ ] 未找到 fixture：包含未找到的 fixture
- [ ] 畸形响应 fixture：包含更改/无效标记的 fixture
- [ ] DOM 解析器：使用结构化 DOM 解析而不是宽泛的正则表达式
- [ ] 选择器小而提供者特定：保持选择器小而提供者特定
- [ ] 稳定解析器错误：当所需页面结构更改时返回稳定的解析器错误
- [ ] 文档 fixture 来源：文档 fixture 来源日期并移除无关页面内容
- [ ] 解析器 fixture 测试：覆盖每个规范化输出字段和失败类别
- [ ] 默认测试套件不执行实时字典请求
- [ ] HTTP 客户端：使用 ofetch 处理字典 API 请求（重试、超时、错误处理）
