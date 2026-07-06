import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  {
    rules: {
      // Lesson content is full of natural-language apostrophes/quotes in JSX
      // text; escaping them all adds noise without catching real bugs.
      'react/no-unescaped-entities': 'off',
    },
  },
];

export default eslintConfig;
