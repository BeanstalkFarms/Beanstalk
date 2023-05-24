import { Graph } from "graphlib";
import { FarmFromMode, FarmToMode } from "src/lib/farm";
import { setBidirectionalExchangeEdges } from "src/lib/swap/graph";
import { getTestUtils } from "src/utils/TestUtils/provider";

const { sdk } = getTestUtils();

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
  it.todo("should have all the edges");
});
