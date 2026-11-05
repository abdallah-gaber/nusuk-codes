import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { languages, pathLanguage } from "./src/i18n";
import { localizedHtml } from "./src/localeMetadata";

function languagePages(): Plugin {
  let output = "";
  return {
    name: "static-language-pages",
    configResolved(config) { output = resolve(config.root, config.build.outDir); },
    transformIndexHtml(html, context) {
      return localizedHtml(html, pathLanguage((context.originalUrl || context.path).split("?")[0]) || "ar");
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        const path = (request.url || "/").split("?")[0];
        const language = pathLanguage(path);
        if (language) request.url = (request.url || "/").replace(path, "/" + language + "/index.html");
        next();
      });
    },
    writeBundle(_, bundle) {
      const index = bundle["index.html"];
      if (!index || index.type !== "asset") throw new Error("Missing built HTML");
      for (const language of languages) {
        const folder = resolve(output, language);
        mkdirSync(folder, { recursive: true });
        writeFileSync(resolve(folder, "index.html"), localizedHtml(String(index.source), language));
      }
    },
  };
}
export default defineConfig({ plugins: [react(), tailwindcss(), languagePages()] });
