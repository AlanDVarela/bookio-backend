import tseslint from 'typescript-eslint';

export default tseslint.config(
  // ─── Archivos a analizar ──────────────────────────────────────────────────
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
  },

  // ─── Archivos ignorados ───────────────────────────────────────────────────
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/**'],
  },

  // ─── Configuración base de TypeScript ESLint ──────────────────────────────
  ...tseslint.configs.recommended,

  // ─── Reglas personalizadas del proyecto ────────────────────────────────────
  {
    rules: {
      // Prevención de errores comunes
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',

      // Buenas prácticas
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  }
);
