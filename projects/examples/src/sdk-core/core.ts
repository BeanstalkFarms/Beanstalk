import { provider } from "../setup";
import { Address, ERC20Token } from "@beanstalk/sdk-core";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const address = new Address({ 1: "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab" });
  const BEAN = new ERC20Token(1, address.get());
  BEAN.setProvider(provider);
  await BEAN.loadFromChain();
  console.log(BEAN);
}
