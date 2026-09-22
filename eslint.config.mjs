import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tsParser from "@typescript-eslint/parser";
import { plugin as shadcn } from "@shadcn/lint";
import designSystem from "./design-system.lint.json" with { type: "json" };

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: rootDirectory });

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: { shadcn },
    settings: {
      shadcn: {
        ui: "@/components/ui",
        mergeFunctions: ["cn"],
        note: "Use the shared tokens and component contracts documented in DESIGN.md.",
      },
    },
    rules: designSystem.rules,
  },
  ...designSystem.overrides.map((override) => ({
    ...override,
    files: override.files,
    rules: override.rules,
  })),
];

export default config;
