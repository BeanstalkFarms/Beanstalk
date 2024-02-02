import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { Token } from "src/classes/Token";
import { FarmFromMode, FarmToMode } from "src/lib/farm/types";
import { Router, RouteStep } from "src/classes/Router";
import { SwapOperation } from "./SwapOperation";
import { getSwapGraph } from "./graph";
import { StepClass } from "src/classes/Workflow";

export class Swap {
  private static sdk: BeanstalkSDK;
  router: Router;

  constructor(sdk: BeanstalkSDK) {
    Swap.sdk = sdk;
    const graph = getSwapGraph(sdk);
    const selfEdgeBuilder = (symbol: string): RouteStep => {
      const token = sdk.tokens.findBySymbol(symbol);
      if (!token) throw new Error(`Could not find a token with symbol "${symbol}"`);

      return {
        build: (account: string, from?: FarmFromMode, to?: FarmToMode): StepClass => {
          return new sdk.farm.actions.TransferToken(token.address, account, from, to);
        },
        from: token.symbol,
        to: token.symbol
      };
    };
    this.router = new Router(sdk, graph, selfEdgeBuilder);
  }

  public buildSwap(tokenIn: Token, tokenOut: Token, account: string, _from?: FarmFromMode, _to?: FarmToMode) {
    const route = this.router.getRoute(tokenIn.symbol, tokenOut.symbol);
    const workflow = Swap.sdk.farm.createAdvancedFarm(`Swap ${tokenIn.symbol}->${tokenOut.symbol}`);

    // Handle Farm Modes
    // For a single step swap (ex, ETH > WETH, or BEAN > BEAN), use the passed modes, if available
    if (route.length === 1) {
      workflow.add(route.getStep(0).build(account, _from || FarmFromMode.EXTERNAL, _to || FarmToMode.EXTERNAL));
    }
    // for a multi step swap (ex, ETH -> WETH -> USDT -> BEAN), we want the user's choices for
    // FarmFromMode and FarmToMode, if supplied, to only apply to the first and last legs
    // of the swap, keeping the intermediate trades as INTERNAL.
    else {
      for (let i = 0; i < route.length; i++) {
        let from, to;
        // First leg, use (USER-DEFINED, INTERNAL)
        if (i == 0) {
          from = _from || FarmFromMode.EXTERNAL;
          to = FarmToMode.INTERNAL;
        }
        // Last leg, use (INTERNAL_TOLERANT, USER-DEFINED)
        else if (i == route.length - 1) {
          // Maybe?
          // from = tokenOut.symbol == "ETH" ? FarmFromMode.INTERNAL : FarmFromMode.INTERNAL_TOLERANT;
          from = FarmFromMode.INTERNAL_TOLERANT;
          to = _to || FarmToMode.EXTERNAL;
        }
        // In-between legs, use (INTERNAL_TOLERANT, INTERNAL)
        else {
          from = FarmFromMode.INTERNAL_TOLERANT;
          to = FarmToMode.INTERNAL;
        }
        workflow.add(route.getStep(i).build(account, from, to));
      }
    }

    const op = new SwapOperation(Swap.sdk, tokenIn, tokenOut, workflow, route);

    return op;
  }

  /**
   * Generate text to paste into http://www.webgraphviz.com/
   * which will show an image based visualization of the current
   * graph
   */
  public getGraph() {
    console.log(this.router.getGraphCode());
  }
}
