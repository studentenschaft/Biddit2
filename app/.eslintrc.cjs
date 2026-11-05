module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  overrides: [
    {
      // Node scripts (ingestion CLI, doc checks), never bundled into the app.
      files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
      env: { node: true, browser: false },
      rules: { 'no-console': 'off' },
    },
    {
      // The DEV-gated logger is the one place allowed to call console.log/info.
      files: ['src/components/helpers/log.js'],
      rules: { 'no-console': 'off' },
    },
    {
      // The singleton apiClient is the only place allowed to use axios.
      files: ['src/components/helpers/axiosClient.js'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
  rules: {
    'react/jsx-no-target-blank': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'axios',
            message: 'Use apiClient from helpers/axiosClient.js',
          },
        ],
      },
    ],
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
