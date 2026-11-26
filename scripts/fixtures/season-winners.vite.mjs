import { fileURLToPath, URL } from "node:url";
import { mergeConfig } from "vite";
import config from "../../vite.config.ts";
import { validateWinners } from "../../src/winners/data.ts";
import { fixtureArchive } from "./season-winners.mjs";

const dataPath = fileURLToPath(new URL("../../src/winners/data.json", import.meta.url));
const fixtureJson = JSON.stringify(validateWinners(fixtureArchive));

export default mergeConfig(config, {
  plugins: [{
    name: "qa-season-winner-fixture",
    enforce: "pre",
    load(id) {
      if (id === dataPath) return fixtureJson;
    },
  }],
});
