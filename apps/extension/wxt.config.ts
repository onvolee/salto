import { defineConfig } from "wxt";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

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
});
