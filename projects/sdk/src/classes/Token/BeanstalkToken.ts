import { Token } from "@beanstalk/sdk-core";
import { TokenValue } from "@beanstalk/sdk-core";

export class BeanstalkToken extends Token {
  public getContract() {
    return null;
  }

  public getBalance() {
    return Promise.resolve(TokenValue.NEGATIVE_ONE);
  }

  public getAllowance() {
    return Promise.resolve(TokenValue.MAX_UINT256);
  }

  public hasEnoughAllowance(): boolean {
    return false; // FIXME
  }

  public getTotalSupply() {
    return undefined;
  }
}
