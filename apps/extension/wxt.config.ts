import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Salto",
    description: "Reading-time translation and vocabulary learning.",
    permissions: ["storage"],
    host_permissions: ["<all_urls>"]
  }
});
