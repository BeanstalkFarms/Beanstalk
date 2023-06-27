import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "graphql.schema.json",
  documents: "src/**/*.graphql",
  ignoreNoDocuments: true,
  generates: {
    "./src/generated/graph/": {
      preset: "client",
      plugins: [],
      presetConfig: {
        fragmentMasking: false
      }
    }
  }
};

export default config;
