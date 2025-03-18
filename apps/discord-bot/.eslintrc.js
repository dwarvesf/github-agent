/** @type {import("eslint").Linter.Config} */
export default {
  root: true,
  extends: ['@packages/eslint-config/base'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
};
