import { Graph } from "graphlib";
import { FarmFromMode, FarmToMode } from "src/lib/farm";
import { AddLiquidity, Exchange, RemoveLiquidityOneToken } from "src/lib/farm/actions";
import { setBidirectionalAddRemoveLiquidityEdges, setBidirectionalExchangeEdges } from "src/lib/swap/graph";
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

    setBidirectionalExchangeEdges(sdk, graph, "pool", "registry", sdk.tokens.DAI, sdk.tokens.USDC);

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

describe("setBidirectionalAddRemoveLiquidityEdges", () => {
  const graph: Graph = new Graph({
    multigraph: true,
    directed: true,
    compound: false
  });

  setBidirectionalAddRemoveLiquidityEdges(sdk, graph, "pool", "registry", sdk.tokens.CRV3, sdk.tokens.USDC, 2);

  expect(graph.hasEdge("3CRV", "USDC")).toBeTruthy();
  expect(graph.hasEdge("USDC", "3CRV")).toBeTruthy();

  const edge0 = graph.edge("3CRV", "USDC");
  const edge1 = graph.edge("USDC", "3CRV");

  // Check: Unwrap CRV3 -> USDC
  expect(edge0.from).toEqual("3CRV");
  expect(edge0.to).toEqual("USDC");
  expect(edge0.build).toBeInstanceOf(Function);

  const build0 = edge0.build("", FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);
  expectInstanceOf(build0, RemoveLiquidityOneToken);
  expect(build0._pool).toEqual("pool");
  expect(build0._registry).toEqual("registry");
  expect(build0._tokenOut).toEqual(sdk.tokens.USDC.address);
  expect(build0._fromMode).toEqual(FarmFromMode.EXTERNAL);
  expect(build0._toMode).toEqual(FarmToMode.INTERNAL);

  // Check: Wrap USDC -> CRV3
  expect(edge1.from).toEqual("USDC");
  expect(edge1.to).toEqual("3CRV");
  expect(edge1.build).toBeInstanceOf(Function);

  const build1 = edge1.build("", FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);
  expectInstanceOf(build1, AddLiquidity);
  expect(build1._pool).toEqual("pool");
  expect(build1._registry).toEqual("registry");
  expect(build1._amounts).toEqual([0, 0, 1]); // USDC is at index 2
  expect(build1._fromMode).toEqual(FarmFromMode.EXTERNAL);
  expect(build1._toMode).toEqual(FarmToMode.INTERNAL);
});

describe("routing", () => {
  const tokens = [sdk.tokens.DAI, sdk.tokens.USDC, sdk.tokens.USDT];
  const symbols = tokens.map((token) => token.symbol);

  describe("3CRV LP", () => {
    it.each(symbols)("%s -> 3CRV uses AddLiquidity", (symbol) => {
      const route = sdk.swap.router.getRoute(symbol, sdk.tokens.CRV3.symbol);
      const step = route.getStep(0).build(account, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);

      expect(route.length).toEqual(1);
      expectInstanceOf(step, AddLiquidity);
      expect(step._pool).toEqual(sdk.contracts.curve.pools.pool3.address);
    });

    it.each(symbols)("3CRV -> %s uses RemoveLiquidity", (symbol) => {
      const route = sdk.swap.router.getRoute(sdk.tokens.CRV3.symbol, symbol);
      const step = route.getStep(0).build(account, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);

      expect(route.length).toEqual(1);
      expectInstanceOf(step, RemoveLiquidityOneToken);
      expect(step._pool).toEqual(sdk.contracts.curve.pools.pool3.address);
    });
  });

  describe("3CRV Underlying", () => {
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
});
