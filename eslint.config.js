import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default ts.config(
  { ignores: ["dist", "node_modules", "admin/.venv/**", ".admin-work/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      // These effects synchronize the CDN feed, storage failures, and the
      // locally recorded display event. Their one follow-up render is intentional.
      "react-hooks/set-state-in-effect": "off",
    },
  },
);
