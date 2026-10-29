module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: { "^.+\\.tsx?$": "<rootDir>/scripts/jest-transform.cjs" },
  moduleNameMapper: { "\\.(css)$": "<rootDir>/scripts/style.cjs" },
};
