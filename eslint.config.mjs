import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [{
  files: [
    '**/*.ts',
    '**/*.js',
    '**/*.mjs'
  ],
  languageOptions: {
    ecmaVersion: 12,
    parser: tsParser,
    globals: {
      ...globals.es2022,
      ...globals.node,
      ...globals.jest,
      ...globals.browser
    }
  },
  "plugins": {
    "@typescript-eslint": tsPlugin
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/ban-ts-comment": "off"
  },
  "ignores": [
    "**/*.d.ts",
    "**/coverage",
    "**/node_modules",
    "**/dist"
  ]
}];
