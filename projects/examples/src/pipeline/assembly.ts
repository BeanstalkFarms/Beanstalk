import { FarmFromMode, FarmToMode } from "@beanstalk/sdk";
import { ethers } from "ethers";
import { sdk, account } from "../setup";

function split32(s: string) {
  let a = [""];
  for (let i = 0; i < s.length; i++) {
    const l = a.length - 1;
    // 64 because a hex digit is 0.5 bytes
    // this chunks into 32 byte segments
    if (a[l].length < 64) {
      a[l] = a[l] + s[i];
    } else {
      a[l + 1] = s[i];
    }
  }
  return a;
}

function splitEncoded(hexstr: string) {
  const lines = [
    // strip 0x, grab first 4 bytes (function selector)
    // function selector doesn't have padding
    hexstr.slice(2, 2 + 8),
    ...split32(hexstr.slice(10, hexstr.length))
  ];
  return [
    // prepend with 32 byte padded hex containing
    // the length of the following `lines`
    lines.length.toString(16).padStart(64, "0"),
    ...lines
  ];
}

function displayAssembly<C extends ethers.Contract, N extends keyof C["functions"], A extends Parameters<C["functions"][N]>>(
  contract: C,
  fname: N,
  args: A
) {
  const fn = contract.interface.getFunction(fname as string);
  const sel = contract.interface.getSighash(fn);
  const data = contract.interface.encodeFunctionData(fname as string, args);
  let totalLength = 0;

  console.log("Encoding a function and displaying byte positions.\n");
  console.log("CONTRACT: ", contract.address);
  console.log("SELECTOR: ", fname, sel);
  console.log("ARGUMENTS:", args);
  console.log("CALLDATA:", data);
  console.log("\n");

  console.log("ASSEMBLY");
  console.log("* The first 32 bytes defines the number of 32 byte slots encoded in the rest of the calldata.");
  console.log("* The next 4 bytes encodes the function selector.");
  console.log("* The remaining sets of 32 bytes (starting at byte 36) encode parameters. The order of encoding is dependent on the ABI.");
  console.log("* Note: 32 bytes of hex data = 64 hex digits.");
  console.log("");

  console.log(
    "idx".padEnd(5, " "),
    /*"slot".padEnd(6, " "),*/ "start".padEnd(5, " "),
    "bytes".padEnd(64, " "),
    "hex".padEnd(16, " "),
    "value".padEnd(16, " ")
  );
  console.log("".padEnd(5, "-"), "".padEnd(5, "-"), "".padEnd(64, "-"), "".padEnd(16, "-"), "".padEnd(16, "-"));

  splitEncoded(data).forEach((s, i) => {
    let hexVal = "";
    if (s !== "0x") {
      let stripped = ethers.utils.hexStripZeros(`0x${s}`);
      hexVal = stripped !== "0x" ? stripped : "0x0";
    }
    console.log(
      i.toString().padEnd(5, " "), // idx
      totalLength.toString().padEnd(5, " "), // start
      s.padStart(64, " "), // bytes
      hexVal.slice(0, 16).padEnd(16, " "), // hex
      hexVal ? parseInt(hexVal, 16) : "-" // value
    );
    totalLength += s.length * 0.5; // 1 hex digit = 0.5 byte
  });
}

// ----

displayAssembly(sdk.contracts.root, "mint", [
  [
    {
      token: sdk.tokens.BEAN.address,
      seasons: ["6075"],
      amounts: [sdk.tokens.BEAN.amount(100).toBlockchain()]
    }
  ],
  FarmToMode.EXTERNAL, // from
  sdk.tokens.ROOT.amount(90).toBlockchain() // minRootsOut
]);

// displayAssembly(sdk.contracts.beanstalk, "transferToken", [
//   sdk.contracts.root.address,
//   account,
//   "1", // amount - will be overwritten by advancedData
//   FarmFromMode.EXTERNAL, // pipeline holds in external
//   FarmFromMode.INTERNAL, // farmer wants in their internal
// ]);
