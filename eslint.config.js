import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Relax some rules for Spark projects:
      // - no-explicit-any: Spark uses 'any' for LLM responses and dynamic content
      "@typescript-eslint/no-explicit-any": "off",
      // - ban-ts-comment: Allow @ts-ignore for Spark-specific APIs (spark.llmPrompt, etc.)
      "@typescript-eslint/ban-ts-comment": "off",
      // - unused-vars: Warn only, as some variables may be for future use
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  }
);
