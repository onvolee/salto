# Use WXT for the extension shell

Salto MVP v0.1 will use WXT as the browser extension framework, with React and TypeScript for extension UI code. WXT matches the planned background service worker, content script, and options page entrypoints while keeping WebExtension APIs and cross-browser builds behind one framework boundary. We considered Plasmo and a hand-rolled Vite/manifest setup, but WXT gives enough structure for the MVP without making the build system the main engineering problem.
