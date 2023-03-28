import { sdk } from "./setup";

sdk.tokens.getMap().forEach((value, key) => {
  console.log(
    `${value.symbol.toString().padEnd(12, " ")} ${value.name.padEnd(36, " ")} ${value.decimals.toString().padEnd(4, " ")} ${value.address
      .toString()
      .padEnd(44, " ")} ${value.constructor.name}`
  );
});
