import { TokenValue } from "@beanstalk/sdk";
import { ethers } from "ethers";

export const makeLocalOnlyStep = (name: string, frontRunAmount?: TokenValue) => {
  const step = async (amountInStep: ethers.BigNumber) => {
    return {
      name: name,
      amountOut: frontRunAmount?.toBigNumber() || amountInStep,
      prepare: () => ({
        target: "",
        callData: ""
      }),
      decode: () => undefined,
      decodeResult: () => undefined
    };
  };

  return step;
};
