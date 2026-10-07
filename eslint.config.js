export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.system_generated/**',
      '**/coverage/**',
      '**/package-lock.json',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
