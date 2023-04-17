#!/usr/bin/env node

// This script can be used for quick cli development without compilation steps.

process.env.MM_DEV = 1;
require("@swc/register")({
  jsc: {
    parser: {
      syntax: "typescript"
    },
    paths: {
      "@sdk/*": ["../sdk/src/*"]
    },
    baseUrl: "."
  },
  module: {
    type: "commonjs"
  }
});

const arg = process.argv[2];
if (!arg) {
  console.log("Usage:");
  console.log("yarn x [file in src folder]");
  console.log("yarn x sdk.ts");
  console.log("yarn x play/myfile.ts");
}
let path;

if (arg.startsWith("./src/")) {
  path = arg;
} else if (arg.startsWith("src/")) {
  path = `./${arg}`;
} else {
  path = `./src/${arg}`;
}

try {
  require(path);
} catch (err) {
  if (err.code === "MODULE_NOT_FOUND") {
    console.log("File not found: ", path);
    console.log(err);
    process.exit(-1);
  }
  console.log(err);
}
