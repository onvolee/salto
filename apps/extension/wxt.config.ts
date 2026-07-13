import { defineConfig } from "wxt";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  alias: {
    "salto-src": resolve("src"),
  },
  webExt: {
    disabled: process.env.SALTO_WXT_NO_BROWSER === "1",
    chromiumProfile: resolve(".wxt/chrome-dev-data"),
    keepProfileChanges: true,
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
});
