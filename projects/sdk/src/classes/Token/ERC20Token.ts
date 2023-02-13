import { ERC20Token as CoreERC20Token, TokenValue } from "@beanstalk/sdk-core";

import { BigNumber, ContractTransaction } from "ethers";
import { addresses } from "src/constants";

declare module "@beanstalk/sdk-core" {
  interface ERC20Token {
    approveBeanstalk(amount: TokenValue | BigNumber): Promise<ContractTransaction>;
  }
}

CoreERC20Token.prototype.approveBeanstalk = function (amount: TokenValue | BigNumber): Promise<ContractTransaction> {
  const beanstalkAddress = addresses.BEANSTALK.get(this.chainId);
  return this.approve(beanstalkAddress, amount);
};

export type ERC20Token = InstanceType<typeof CoreERC20Token>
export const ERC20Token = CoreERC20Token;
