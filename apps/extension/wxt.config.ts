import { defineConfig } from "wxt";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import { codeInspectorPlugin } from 'code-inspector-plugin';

export default defineConfig({
  alias: {
    "salto-src": resolve("src"),
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Salto",
    description: "Reading-time translation and vocabulary learning.",
    permissions: ["storage"],
    host_permissions: ["<all_urls>"],
  },
  hooks: {
    "vite:devServer:extendConfig": (viteConfig) => {
      viteConfig.plugins = [
        codeInspectorPlugin({
          bundler: "vite",
          injectTo: [
            resolve("entrypoints/popup/main.tsx"),
            resolve("entrypoints/setting.options/main.tsx"),
          ],
        }),
        ...(viteConfig.plugins ?? []),
      ];
    },
    "build:manifestGenerated": (_wxt, manifest) => {
      manifest.options_ui = {
        page: "setting.html",
        open_in_tab: true,
      };
    },
  },
});
