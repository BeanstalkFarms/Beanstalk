import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  projects: [
    {
      // @ts-ignore
      preset: "ts-jest",
      displayName: "sdk",
      rootDir: "projects/sdk",
      testMatch: ["<rootDir>/src/**/?(*.)+(spec|test).[jt]s?(x)"],
      moduleNameMapper: {
        "@sdk/(.*)$": "<rootDir>/src/$1",
        "src/(.*)$": "<rootDir>/src/$1"
      }
    },
    {
      // @ts-ignore
      preset: "ts-jest",
      displayName: "examples",
      rootDir: "projects/examples",
      testMatch: ["<rootDir>/src/**/?(*.)+(spec|test).[jt]s?(x)"]
    }
  ]
};

export default jestConfig;
