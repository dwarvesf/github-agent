/** @type {import("eslint").Linter.Config} */
export default {
  root: true,
  extends: ['../../packages/eslint-config/base.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['never', { varsIgnorePattern: '^_' }],
  },
};
