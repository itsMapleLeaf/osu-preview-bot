module.exports = {
  extends: [require.resolve("@itsmapleleaf/configs/eslint")],
  ignorePatterns: ["**/node_modules/**"],
  rules: {
    "import/no-unused-modules": "off",
  },
}
