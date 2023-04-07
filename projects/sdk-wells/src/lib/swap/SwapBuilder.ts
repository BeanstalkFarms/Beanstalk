import { Token } from "@beanstalk/sdk-core";
import { Router } from "../routing";
import { Well } from "../Well";
import { Quote } from "./Quote";
import { WellsSDK } from "../WellsSDK";

export class SwapBuilder {
  private readonly sdk: WellsSDK;
  router: Router;

  constructor(sdk: WellsSDK) {
    this.sdk = sdk;
    this.router = new Router();
  }

  async addWell(well: Well) {
    await this.router.addWell(well);
  }

  buildQuote(fromToken: Token, toToken: Token, account: string): Quote | null {
    const route = this.router.getRoute(fromToken, toToken);
    if (route.length < 1) return null;

    return new Quote(this.sdk, fromToken, toToken, route, account);
  }
}
