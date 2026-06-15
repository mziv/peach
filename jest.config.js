module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|tailwindcss)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  // Ignore git worktrees nested under .claude/ — their duplicate node_modules
  // (each with its own react-native copy) otherwise pollute Jest's haste map
  // and break component suites with native-module load errors.
  modulePathIgnorePatterns: ["<rootDir>/\\.claude/"],
};
