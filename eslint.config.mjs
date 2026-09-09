import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Obsidian vault ships the editor's own vendored, minified plugin
    // bundles. Linting them drowned `npm run lint` in ~318 errors / 4600
    // warnings of third-party noise, which made the command useless as a
    // quality gate — a real failure would never have been noticed in there.
    "docs/**/.obsidian/**",
    // Playwright's generated HTML report and run artifacts — vendored bundles,
    // same problem as above.
    "tests/.report/**",
    "tests/.output/**",
    "tests/.snapshots/**",
  ]),
]);

export default eslintConfig;
