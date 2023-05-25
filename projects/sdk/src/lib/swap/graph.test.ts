import { Graph } from "graphlib";
import { FarmFromMode, FarmToMode } from "src/lib/farm";
import { AddLiquidity, Exchange, RemoveLiquidityOneToken } from "src/lib/farm/actions";
import { setBidirectionalExchangeEdges } from "src/lib/swap/graph";
import { expectInstanceOf } from "src/utils";
import { getTestUtils } from "src/utils/TestUtils/provider";

const { sdk, account } = getTestUtils();

describe("setBidirectionalExchangeEdges", () => {
  it("adds both edges to the Graph instance", () => {
    const graph: Graph = new Graph({
      multigraph: true,
      directed: true,
      compound: false
    });

    const POOL = "pool";
    const REGISTRY = "registry";

    setBidirectionalExchangeEdges(sdk, graph, POOL, REGISTRY, sdk.tokens.DAI, sdk.tokens.USDC);

    // Check: Existence
    expect(graph.hasEdge("DAI", "USDC")).toBeTruthy();
    expect(graph.hasEdge("USDC", "DAI")).toBeTruthy();

    const edge0 = graph.edge("DAI", "USDC");
    const edge1 = graph.edge("USDC", "DAI");

    // Check: 0 -> 1
    expect(edge0.from).toEqual("DAI");
    expect(edge0.to).toEqual("USDC");
    expect(edge0.build).toBeInstanceOf(Function);

    const build0 = edge0.build("", FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);
    expect(build0).toBeInstanceOf(sdk.farm.actions.Exchange);
    expect(build0.pool).toEqual("pool");
    expect(build0.registry).toEqual("registry");
    expect(build0.tokenIn).toEqual(sdk.tokens.DAI);
    expect(build0.tokenOut).toEqual(sdk.tokens.USDC);
    expect(build0.fromMode).toEqual(FarmFromMode.EXTERNAL);
    expect(build0.toMode).toEqual(FarmToMode.INTERNAL);

    // Check: 1 -> 0
    expect(edge1.from).toEqual("USDC");
    expect(edge1.to).toEqual("DAI");
    expect(edge1.build).toBeInstanceOf(Function);

    const build1 = edge1.build("", FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);
    expect(build1).toBeInstanceOf(sdk.farm.actions.Exchange);
    expect(build1.pool).toEqual("pool");
    expect(build1.registry).toEqual("registry");
    expect(build1.tokenIn).toEqual(sdk.tokens.USDC);
    expect(build1.tokenOut).toEqual(sdk.tokens.DAI);
    expect(build1.fromMode).toEqual(FarmFromMode.EXTERNAL);
    expect(build1.toMode).toEqual(FarmToMode.INTERNAL);
  });
});

describe("graph", () => {
  const tokens = [sdk.tokens.DAI, sdk.tokens.USDC, sdk.tokens.USDT];

  // describe("wrap/unwrap LP", () => {
  //   it.each(tokens)("%s -> 3CRV uses AddLiquidity", (token) => {
  //     const route = sdk.swap.router.getRoute(token.symbol, sdk.tokens.CRV3.symbol);
  //     const step = route.getStep(0).build(account, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);

  //     expect(route.length).toEqual(1);
  //     expectInstanceOf(step, AddLiquidity);
  //     expect(step._pool).toEqual(sdk.contracts.curve.pools.pool3.address);
  //   });

  //   it.each(tokens)("3CRV -> %s uses RemoveLiquidity", (token) => {
  //     const route = sdk.swap.router.getRoute(sdk.tokens.CRV3.symbol, token.symbol);
  //     const step = route.getStep(0).build(account, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);

  //     expect(route.length).toEqual(1);
  //     expectInstanceOf(step, RemoveLiquidityOneToken);
  //     expect(step._pool).toEqual(sdk.contracts.curve.pools.pool3.address);
  //   });
  // });

  // Make sure that stable swaps are efficient
  // TODO: use it.each to better describe tests
  it("routes 3CRV stable <> stable via 3pool", () => {
    // For any combination of the above tokens, there should be a route via 3pool
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        if (i === j) continue;

        const route = sdk.swap.router.getRoute(tokens[i].symbol, tokens[j].symbol);
        const step = route.getStep(0).build(account, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);

        // Expectation: There's a single step which is an Exchange via 3pool
        expect(route.length).toEqual(1);
        expectInstanceOf(step, Exchange);
        expect(step.pool).toEqual(sdk.contracts.curve.pools.pool3.address);
        expect(step.tokenIn).toEqual(tokens[i]);
        expect(step.tokenOut).toEqual(tokens[j]);
      }
    }
  });
});
