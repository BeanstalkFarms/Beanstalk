import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { Log } from "src/utils/logger";

const hasMinimumAllowance = async (walletAddress: string, spender: string, token: ERC20Token | Token, mininumAllowance: TokenValue) => {
  const existingAllowance = await token.getAllowance(walletAddress, spender);
  if (!existingAllowance) {
    return false;
  }
  return existingAllowance.gte(mininumAllowance);
};

const ensureAllowance = async (walletAddress: string, spender: string, token: ERC20Token, mininumAllowance: TokenValue) => {
  if (!(await hasMinimumAllowance(walletAddress, spender, token, mininumAllowance))) {
    try {
      const approveTXN = await token.getContract().approve(spender, mininumAllowance.toBigNumber(), { gasLimit: 50000 });
      await approveTXN.wait();
    } catch (error: any) {
      Log.module("allowance").error("Error druing ensureAllowance: ", (error as Error).message);
    }
  }
};

export { ensureAllowance, hasMinimumAllowance };
