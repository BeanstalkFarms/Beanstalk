import { Token, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { sdk, account as _account, chain } from "../setup";
import { getWellsFromAquifer } from "./utils";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const tokens = new Set<Token>();
  const wells = await getWellsFromAquifer(sdk, "0x0c03eCB91Cb50835e560a7D52190EB1a5ffba797");
  for await (const well of wells) {
    const wellTokens = await well.getTokens();
    for await (const token of wellTokens) {
      await token.approve(well.address, TokenValue.ZERO);
      console.log(`Revoked ${token.symbol}`);
    }
  }

  // for await (const token of tokens) {
  //   console.log(token.symbol);
  // }
}
