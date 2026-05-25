import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname
});

const nextAppFiles = [
  "apps/central-admin/**/*.{ts,tsx}",
  "apps/seller-portal/**/*.{ts,tsx}",
  "apps/tenant-portal/**/*.{ts,tsx}",
  "apps/storefront/**/*.{ts,tsx}",
  "apps/courier-app/**/*.{ts,tsx}"
];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.medusa/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/build/**",
      "infra/data/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals", "next/typescript").map((config) => ({
    ...config,
    files: nextAppFiles
  })),
  {
    files: ["apps/*/next-env.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off"
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-console": "off"
    }
  }
];
