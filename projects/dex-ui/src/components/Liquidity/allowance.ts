import { ERC20Token } from "@beanstalk/sdk-core";
import { BigNumber } from "ethers";
import { Log } from "src/utils/logger";

const hasMinimumAllowance = async (walletAddress: string, spender: string, token: ERC20Token, mininumAllowance: BigNumber) => {
  const existingAllowance = await token.getAllowance(walletAddress, spender);
  return existingAllowance.toBigNumber().gte(mininumAllowance);
};

const ensureAllowance = async (walletAddress: string, spender: string, token: ERC20Token, mininumAllowance: BigNumber) => {
  if (!(await hasMinimumAllowance(walletAddress, spender, token, mininumAllowance))) {
    try {
      const approveTXN = await token.getContract().approve(spender, mininumAllowance, { gasLimit: 50000 });
      await approveTXN.wait();
    } catch (error: any) {
      Log.module("allowance").error("Error druing ensureAllowance: ", (error as Error).message);
    }
  }
};

export { ensureAllowance, hasMinimumAllowance };
