import fs from "fs";
import path from "path";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import multi from "@rollup/plugin-multi-entry";
import excludeDeps from "rollup-plugin-exclude-dependencies-from-bundle";
import alias from "rollup-plugin-alias";
import sourcemaps from "rollup-plugin-sourcemaps";

const pkg = require("./package.json");
delete pkg.exports;

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [
  // do not change the "sdk" value, it is a 'magic string' that represents
  // the main entry point in various ways
  makeEntry("dist/js/index.js", "wells")

  // This is just an example of how to create a new module entry.
  // This lets you do this on the client side:
  // import { Thing } from "@beanstalk/sdk/Thing"
  // makeEntry("dist/js/DecimalBigNumber.js", "DecimalBigNumber"),
  // makeEntry("dist/js/TokenValue.js", "TokenValue")
];

export default config;

function makeEntry(inputFile, name) {
  const outRoot = "dist";
  const typesPath = `./${outRoot}/types/${name === "wells" ? "index" : name}.d.ts`;
  const esmPath = `./${outRoot}/${name}/${name}.esm.js`;
  const cjsPath = `./${outRoot}/${name}/${name}.cjs.js`;
  const udmPath = `./${outRoot}/${name}/${name}.umd.js`;

  let config = {
    input: inputFile,
    output: [
      { file: esmPath, format: "es", sourcemap: true },
      { file: cjsPath, format: "cjs", sourcemap: true },
      { file: udmPath, format: "umd", sourcemap: true, name: "WellsSDK" }
    ],
    external: Object.keys(pkg.dependencies || {}),
    plugins: [
      resolve(),
      commonjs(),
      json(),
      excludeDeps(),
      multi({ preserveModules: true }),
      alias({
        resolve: [".js", ".d.ts"],
        entries: [{ find: "src", replacement: path.join(__dirname, "./dist/js") }]
      }),
      sourcemaps()
    ]
  };

  const pkgExport = {
    types: typesPath,
    module: esmPath,
    default: cjsPath,
    browser: udmPath
  };

  pkg.exports = pkg.exports || {};
  const key = name === "wells" ? "." : `./${name}`;
  pkg.exports[key] = pkgExport;

  // Write back to package.json !!!!
  fs.writeFileSync("./package.json", JSON.stringify(pkg, null, 2) + "\n");

  return config;
}
