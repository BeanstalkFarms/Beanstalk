import { Graph } from "graphlib";
import { ERC20Token } from "src/classes/Token";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { FarmFromMode, FarmToMode } from "src/lib/farm";

/**
 * Creates an instance of sdk.farm.actions.Exchange to swap between token0 <> token1 via `pool`.
 * Simplifies the `getSwapGraph` setup code below and ensures that both edges are added to the graph.
 */
export const setBidirectionalExchangeEdges = (
  sdk: BeanstalkSDK,
  g: Graph,
  pool: string,
  registry: string,
  token0: ERC20Token,
  token1: ERC20Token
) => {
  const token0s = token0.symbol;
  const token1s = token1.symbol;

  // token0 -> token1
  g.setEdge(token0s, token1s, {
    build: (_: string, from: FarmFromMode, to: FarmToMode) => new sdk.farm.actions.Exchange(pool, registry, token0, token1, from, to),
    from: token0s,
    to: token1s
  });

  // token1 -> token0
  g.setEdge(token1s, token0s, {
    build: (_: string, from: FarmFromMode, to: FarmToMode) => new sdk.farm.actions.Exchange(pool, registry, token1, token0, from, to),
    from: token1s,
    to: token0s
  });
};

export const getSwapGraph = (sdk: BeanstalkSDK): Graph => {
  const graph: Graph = new Graph({
    multigraph: true,
    directed: true,
    compound: false
  });

  ////// Add Nodes

  graph.setNode("ETH", { token: sdk.tokens.ETH });
  graph.setNode("WETH", { token: sdk.tokens.WETH });
  graph.setNode("BEAN", { token: sdk.tokens.BEAN });
  graph.setNode("3CRV", { token: sdk.tokens.CRV3 });
  graph.setNode("USDT", { token: sdk.tokens.USDT });
  graph.setNode("USDC", { token: sdk.tokens.USDC });
  graph.setNode("DAI", { token: sdk.tokens.DAI });

  ////// Add Edges

  /// ETH<>WETH via Wrap/Unwrap

  graph.setEdge("ETH", "WETH", {
    build: (_: string, _2: FarmFromMode, to: FarmToMode) => new sdk.farm.actions.WrapEth(to),
    from: "ETH",
    to: "WETH"
  });
  graph.setEdge("WETH", "ETH", {
    build: (_: string, from: FarmFromMode, _2: FarmToMode) => new sdk.farm.actions.UnwrapEth(from),
    from: "WETH",
    to: "ETH"
  });

  /// USDT<>WETH via tricrypto2 Exchange

  graph.setEdge("WETH", "USDT", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.weth2usdt(from, to),
    from: "WETH",
    to: "USDT"
  });
  graph.setEdge("USDT", "WETH", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.usdt2weth(from, to),
    from: "USDT",
    to: "WETH"
  });

  /// USDT<>BEAN via Metapool Exchange Underlying

  graph.setEdge("USDT", "BEAN", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.usdt2bean(from, to),
    from: "USDT",
    to: "BEAN"
  });
  graph.setEdge("BEAN", "USDT", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.bean2usdt(from, to),
    from: "BEAN",
    to: "USDT"
  });

  /// USDC<>BEAN via Metapool Exchange Underlying

  graph.setEdge("USDC", "BEAN", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.USDC, sdk.tokens.BEAN, from, to),
    from: "USDC",
    to: "BEAN"
  });
  graph.setEdge("BEAN", "USDC", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.BEAN, sdk.tokens.USDC, from, to),
    from: "BEAN",
    to: "USDC"
  });

  /// DAI<>BEAN via Metapool Exchange Underlying

  graph.setEdge("DAI", "BEAN", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.DAI, sdk.tokens.BEAN, from, to),
    from: "DAI",
    to: "BEAN"
  });

  graph.setEdge("BEAN", "DAI", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.BEAN, sdk.tokens.DAI, from, to),
    from: "BEAN",
    to: "DAI"
  });

  /// CRV3<>BEAN via Metapool Exchange

  graph.setEdge("3CRV", "BEAN", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.Exchange(
        sdk.contracts.curve.pools.beanCrv3.address,
        sdk.contracts.curve.registries.metaFactory.address,
        sdk.tokens.CRV3,
        sdk.tokens.BEAN,
        from,
        to
      ),
    from: "3CRV",
    to: "BEAN"
  });

  graph.setEdge("BEAN", "3CRV", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.Exchange(
        sdk.contracts.curve.pools.beanCrv3.address,
        sdk.contracts.curve.registries.metaFactory.address,
        sdk.tokens.BEAN,
        sdk.tokens.CRV3,
        from,
        to
      ),
    from: "BEAN",
    to: "3CRV"
  });

  /// 3CRV<>Stables via 3Pool Add/Remove Liquidity

  graph.setEdge("3CRV", "USDC", {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.RemoveLiquidityOneToken(
        sdk.contracts.curve.pools.pool3.address,
        sdk.contracts.curve.registries.poolRegistry.address,
        sdk.tokens.USDC.address,
        from,
        to
      ),
    from: "3CRV",
    to: "USDC"
  });

  ////// 3Pool Exchanges

  /// USDC<>USDT via 3Pool Exchange

  setBidirectionalExchangeEdges(
    sdk,
    graph,
    sdk.contracts.curve.pools.pool3.address,
    sdk.contracts.curve.registries.poolRegistry.address,
    sdk.tokens.USDC,
    sdk.tokens.USDT
  );

  /// USDC<>DAI via 3Pool Exchange

  setBidirectionalExchangeEdges(
    sdk,
    graph,
    sdk.contracts.curve.pools.pool3.address,
    sdk.contracts.curve.registries.poolRegistry.address,
    sdk.tokens.USDC,
    sdk.tokens.DAI
  );

  /// USDT<>DAI via 3Pool Exchange

  setBidirectionalExchangeEdges(
    sdk,
    graph,
    sdk.contracts.curve.pools.pool3.address,
    sdk.contracts.curve.registries.poolRegistry.address,
    sdk.tokens.USDT,
    sdk.tokens.DAI
  );

  return graph;
};
