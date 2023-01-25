import { BeanstalkSDK, TestUtils, Token, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { ethers } from "ethers";

export const setPrice = async (sdk: BeanstalkSDK, chain: TestUtils.BlockchainUtils, { params }) => {
  const BALANCE_SLOT = 3;
  const PREV_BALANCE_SLOT = 5;
  const POOL_ADDRESS = "0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49";

  const [currentBean, currentCrv3] = await getBalance(BALANCE_SLOT, POOL_ADDRESS, sdk);
  console.log(`Current Balances: ${currentBean.toHuman()} ${currentCrv3.toHuman()}`);

  const [beanInput, crv3Input] = params || [];
  console.log(beanInput, crv3Input);

  const newBeanAmount = (beanInput ? beanInput : 20) * 1_000_000;
  const newCrv3Amount = (crv3Input ? crv3Input : beanInput ? beanInput : 20) * 1_000_000;

  const newBean = sdk.tokens.BEAN.amount(newBeanAmount);
  const newCrv3 = sdk.tokens.CRV3.amount(newCrv3Amount);

  ////// Set the new balance
  console.log(`New Balances: ${newBean.toHuman()} ${newCrv3.toHuman()}`);
  // update the array tracking balances
  await setBalance(sdk, POOL_ADDRESS, BALANCE_SLOT, newBean, newCrv3);
  // actually give the pool the ERC20's
  await chain.setBEANBalance(POOL_ADDRESS, newBean);
  await chain.setCRV3Balance(POOL_ADDRESS, newCrv3);

  // Curve also keeps track of the previous balance, so we just copy the existing current to old.
  await setBalance(sdk, POOL_ADDRESS, PREV_BALANCE_SLOT, currentBean, currentCrv3);
};

async function getBalance(slot, address, sdk: BeanstalkSDK) {
  const beanLocation = ethers.utils.solidityKeccak256(["uint256"], [slot]);
  const crv3Location = addOne(beanLocation);

  const t1 = await sdk.provider.getStorageAt(address, beanLocation);
  const beanAmount = TokenValue.fromBlockchain(t1, sdk.tokens.BEAN.decimals);

  const t2 = await sdk.provider.getStorageAt(address, crv3Location);
  const crv3Amount = TokenValue.fromBlockchain(t2, sdk.tokens.CRV3.decimals);

  return [beanAmount, crv3Amount];
}

function addOne(kek) {
  let b = ethers.BigNumber.from(kek);
  b = b.add(1);
  return b.toHexString();
}

async function setBalance(sdk, address: string, slot: number, beanBalance: TokenValue, crv3Balance: TokenValue) {
  const beanLocation = ethers.utils.solidityKeccak256(["uint256"], [slot]);
  const crv3Location = addOne(beanLocation);

  // Set BEAN balance
  await setStorageAt(sdk, address, beanLocation, toBytes32(beanBalance.toBigNumber()).toString());
  // Set 3CRV balance
  await setStorageAt(sdk, address, crv3Location, toBytes32(crv3Balance.toBigNumber()).toString());
}

async function setStorageAt(sdk, address: string, index: string, value: string) {
  await sdk.provider.send("hardhat_setStorageAt", [address, index, value]);
}

function toBytes32(bn: ethers.BigNumber) {
  return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
}
