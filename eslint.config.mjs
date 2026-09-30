import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { 
    files: ["**/*.{js,mjs,cjs}"], 
    languageOptions: { 
      globals: {
        ...globals.node,
        ...globals.jest // This adds test, expect, beforeAll, etc.
      } 
    } 
  },
  { files: ["**/*.js"], languageOptions: { sourceType: "script" } },
]);