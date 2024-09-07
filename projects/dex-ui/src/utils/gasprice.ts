import { BigNumber } from "ethers";
import { formatEther } from "ethers/lib/utils.js";

import { BeanstalkSDK } from "@beanstalk/sdk";

import { getPrice } from "./price/usePrice";

export const getGasInUsd = async (sdk: BeanstalkSDK, value: BigNumber) => {
  const feeData = await sdk.provider.getFeeData();
  const ethPrice = await getPrice(sdk.tokens.ETH, sdk);

  if (!feeData.maxFeePerGas || !ethPrice) {
    return 0;
  }

  const txEthAmount = value.mul(feeData.maxFeePerGas);
  const txEthAmountNumber = formatEther(txEthAmount);
  return parseFloat(ethPrice.toHuman()) * parseFloat(txEthAmountNumber);
};
