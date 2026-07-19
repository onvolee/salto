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
    commands: {
      "open-selection-panel": {
        description: "Open the selection translation panel",
        suggested_key: {
          default: "Alt+Shift+S",
          mac: "MacCtrl+Shift+S",
        },
      },
    },
    optional_host_permissions: [
      "https://*/*",
      "http://*/*",
    ],
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
