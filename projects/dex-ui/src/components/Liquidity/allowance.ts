import { ERC20Token } from "@beanstalk/sdk-core";
import { BigNumber } from "ethers";

const hasMinimumAllowance = async (walletAddress: string, spender: string, token: ERC20Token, mininumAllowance: BigNumber) => {
  const existingAllowance = await token.getContract().allowance(walletAddress, spender);
  
  if (!existingAllowance) {
    throw new Error("Unable to retrieve allowance");
  }
  
  return existingAllowance.gte(mininumAllowance);
};

const ensureAllowance = async (
  walletAddress: string,
  spender: string,
  token: ERC20Token,
  mininumAllowance: BigNumber,
  allowanceCallback: () => void
) => {
  if (!(await hasMinimumAllowance(walletAddress, spender, token, mininumAllowance))) {
    try {
      const approveTXN = await token.getContract().approve(spender, mininumAllowance, { gasLimit: 50000 });
      await approveTXN.wait();
    } catch (error: any) {
      // TODO: open notification?
      console.log(error);
      console.error(`Error while approving allowance: ${error.message}`);
    }

    if (allowanceCallback) {
      allowanceCallback();
    }
  }
};

export { ensureAllowance, hasMinimumAllowance };
