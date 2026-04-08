// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(...tseslint.configs.recommended, {
  files: ["src/**/*.ts"],
  ignores: ["dist/"],
});
