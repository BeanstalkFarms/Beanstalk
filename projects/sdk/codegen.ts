import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  // Share the committed Beanstalk snapshot with the UI; refresh explicitly there.
  schema: "../ui/src/graph/schema-beanstalk.graphql",
  documents: "src/queries/**/*.graphql",
  generates: {
    "src/constants/generated-gql/graphql.ts": {
      plugins: ["typescript", "typescript-operations", "typescript-graphql-request"]
    }
  }
};

export default config;
