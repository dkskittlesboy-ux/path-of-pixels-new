import globals from "globals";

export default [
  {
    files: ["js/**/*.js", "tests/**/*.js", "eslint.config.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-undef": "error",
      "no-dupe-args": "error",
      "no-dupe-class-members": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "valid-typeof": "error",
    },
  },
];
