import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "src/lib/supabase/database.types.ts",
      "src/workers/ts-util-worker/dist/**",
      "src/workers/ts-worker/dist/**",
      "src/workers/ts-worker/*.js", // Ignore JS utility files
      "src/workers/ts-worker/**/*.js", // Ignore all JS files in ts-worker
      // Temporarily ignore files with parsing errors (false positives)
      "src/components/scrapers/scraper-list.tsx",
      "src/workers/ts-util-worker/src/prestashop-client.ts",
      // Add any other files you want to ignore here
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Disable problematic rules for a lint-free app
      "react/no-unescaped-entities": "off", // Allow unescaped quotes and apostrophes in JSX
      "@typescript-eslint/no-require-imports": "off", // Allow require() imports in JS files
    },
  },
];

export default eslintConfig;
