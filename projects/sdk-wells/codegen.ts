import type { CodegenConfig } from "@graphql-codegen/cli";

import defaults from "./src/defaultSettings.json";

const config: CodegenConfig = {
  overwrite: true,
  schema: defaults.subgraphUrl,
  documents: "src/queries/**/*.graphql",
  generates: {
    "src/constants/generated-gql/graphql.ts": {
      plugins: ["typescript", "typescript-operations", "typescript-graphql-request"]
    }
  }
};

export default config;
