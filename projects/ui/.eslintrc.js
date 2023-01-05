/** @type {import('eslint').Linter.Config} */
module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    'jest/globals': true
  },
  globals: {
    page: 'readonly',
    JSX: true
  },
  // https://typescript-eslint.io/docs/linting/
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  ignorePatterns: [
    'src/constants/abi/**/*.json',
    'src/generated/**/*',
    'src/graph/graphql.schema.json',
  ],
  plugins: [
    'react',
    'react-hooks',
    '@typescript-eslint',
    'jest',
    'unused-imports',
  ],
  extends: [
    'plugin:react/recommended',
    'airbnb',
    'plugin:storybook/recommended'
  ],
  rules: {
    // -- Tree-shaking
    // https://mui.com/material-ui/guides/minimizing-bundle-size/#option-1
    'no-restricted-imports': ['error', {
      patterns: ['@mui/*/*/*', '!@mui/material/test-utils/*']
    }],

    /// Automatically remove unused imports
    /// https://github.com/sweepline/eslint-plugin-unused-imports#usage
    '@typescript-eslint/no-unused-vars': 'off',
    'no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',  // fixable
    'unused-imports/no-unused-vars': [ // NOT auto-fixable
      'warn',
      { 
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_'
      }
    ],

    // -- Stylistic
    'react/no-unused-prop-types': 'warn',
    'arrow-parens': 'warn',
    semi: 'warn',
    'quote-props': 'warn',
    'import/order': 'warn',
    'space-infix-ops': 'warn',
    'react/jsx-indent': 'warn',
    quotes: ['warn', 'single'],
    'comma-dangle': 0,
    'no-multiple-empty-lines': 'warn',
    'jsx-quotes': ['error', 'prefer-double'],
    'react/jsx-curly-brace-presence': 'warn',
    'eol-last': 'warn',
    'key-spacing': 0,
    // I like to line up my values sometimes
    'no-multi-spaces': 0,
    'react/jsx-boolean-value': 'warn',
    'react/jsx-props-no-multi-spaces': 'warn',
    'spaced-comment': 'warn',
    'brace-style': 0,
    'keyword-spacing': 'warn',
    'jsx-a11y/anchor-is-valid': 0,
    'react/self-closing-comp': 'warn',
    'react/jsx-no-duplicate-props': ['warn', { ignoreCase: false }],
    // 'comma-dangle': ['warn', {
    //   arrays: 'always-multiline',
    //   imports: 'always-multiline',
    //   exports: 'always-multiline',
    //   functions: 'never',
    //   objects: 'always-multiline',
    // }],
    // -- Space efficiency
    'arrow-body-style': 'warn',
    'no-trailing-spaces': 0,

    // -- Other (to categorize)
    'react/button-has-type': 0,
    'react/require-default-props': 0,
    'max-classes-per-file': 0,
    'react/jsx-filename-extension': ['error', {
      extensions: ['.ts', '.tsx']
    }],
    'no-continue': 0,
    'import/extensions': 0,
    'newline-per-chained-call': 0,
    'no-use-before-define': 0,
    '@typescript-eslint/no-use-before-define': 'error',
    'import/prefer-default-export': 0,
    'react/jsx-props-no-spreading': 0,
    'jsx-a11y/label-has-associated-control': 0,
    'consistent-return': 0,
    'linebreak-style': 0,
    'no-param-reassign': 0,
    'no-unused-expressions': ['error', {
      allowShortCircuit: true,
      allowTernary: true
    }],
    'max-len': 0,
    'react/no-array-index-key': 0,
    'no-mixed-operators': 0,
    'operator-linebreak': 0,
    'import/no-mutable-exports': 0,
    'no-underscore-dangle': 0,
    'import/no-extraneous-dependencies': 0,
    'implicit-arrow-linebreak': 0,
    'object-curly-newline': 0,
    'function-paren-newline': 0,
    indent: 0,
    'react/prop-types': 0,
    'prefer-destructuring': 0,
    'react/destructuring-assignment': 0,
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'react/jsx-one-expression-per-line': 'off',
    'react/jsx-closing-bracket-location': 0,
    'react/jsx-curly-newline': 0,
    'no-nested-ternary': 0,
    'react/jsx-wrap-multilines': 0,
    'no-await-in-loop': 0,
    'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/no-extra-non-null-assertion': ['error'],
    'no-console': 'off',
    'object-shorthand': 0,
    'comma-spacing': 0,
    'react/jsx-tag-spacing': 'warn',
    camelcase: 0,
    // disable because generated files aren't camel-cased
    'padded-blocks': 'warn',
    'import/no-useless-path-segments': 'warn'
  },
  settings: {
    'import/resolver': {
      typescript: {}
    }
  },
  overrides: [
    {
      files: [
        '**/*.stories.*'
      ],
      rules: {
        'import/no-anonymous-default-export': 'off'
      }
    }
  ],
};
