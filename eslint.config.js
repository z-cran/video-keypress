import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist", "coverage", "node_modules"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite()
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      // The barrels cost seconds per test file; import leaf paths instead.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@mui/material",
              message: "Import from the leaf path, e.g. @mui/material/Button."
            },
            {
              name: "@mui/icons-material",
              message:
                "Import from the leaf path, e.g. @mui/icons-material/PlayArrow."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      // Test doubles often stand in for DOM methods with loose shapes.
      "@typescript-eslint/unbound-method": "off"
    }
  },
  {
    files: ["eslint.config.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node }
  }
);
