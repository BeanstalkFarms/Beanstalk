import { Graph } from "graphlib";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { ERC20Token } from "src/classes/Token";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { FarmFromMode, FarmToMode } from "src/lib/farm";

export const setBidirectionalAddRemoveLiquidityEdges = (
  sdk: BeanstalkSDK,
  g: Graph,
  pool: string,
  registry: string,
  lpToken: ERC20Token,
  underlyingToken: ERC20Token,
  underlyingTokenIndex: number,
  underlyingTokenCount: number = 3
) => {
  // creates an array like [1, 0, 0], [0, 1, 0], [0, 0, 1].
  const amounts = Array.from({ length: underlyingTokenCount }, (_, i) =>
    i === underlyingTokenIndex ? 1 : 0
  );

  // Underlying -> LP uses AddLiquidity.
  g.setEdge(underlyingToken.symbol, lpToken.symbol, {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.AddLiquidity(pool, registry, amounts as any, from, to),
    from: underlyingToken.symbol,
    to: lpToken.symbol,
    label: "addLiquidity"
  });

  // LP -> Underlying is RemoveLiquidity
  g.setEdge(lpToken.symbol, underlyingToken.symbol, {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.RemoveLiquidityOneToken(
        pool,
        registry,
        underlyingToken.address,
        from,
        to
      ),
    from: lpToken.symbol,
    to: underlyingToken.symbol,
    label: "removeLiquidity"
  });
};

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
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.Exchange(pool, registry, token0, token1, from, to),
    from: token0s,
    to: token1s
  });

  // token1 -> token0
  g.setEdge(token1s, token0s, {
    build: (_: string, from: FarmFromMode, to: FarmToMode) =>
      new sdk.farm.actions.Exchange(pool, registry, token1, token0, from, to),
    from: token1s,
    to: token0s
  });
};

const setBiDirectionalWellSwapEdges = (sdk: BeanstalkSDK, g: Graph, well: BasinWell) => {
  const [token0, token1] = well.tokens;

  g.setEdge(token0.symbol, token1.symbol, {
    build: (account: string, from: FarmFromMode, to: FarmToMode) =>
      sdk.farm.presets.wellSwap(well, token0, token1, account, from, to),
    from: token0.symbol,
    to: token1.symbol
  });
};

export const getSwapGraph = (sdk: BeanstalkSDK): Graph => {
  const graph: Graph = new Graph({
    multigraph: true,
    directed: true,
    compound: false
  });

  ////// Add Nodes

  graph.setNode(sdk.tokens.ETH.symbol, {
    token: sdk.tokens.ETH
  });
  graph.setNode(sdk.tokens.WETH.symbol, {
    token: sdk.tokens.WETH
  });
  graph.setNode(sdk.tokens.WSTETH.symbol, {
    token: sdk.tokens.WSTETH
  });
  graph.setNode(sdk.tokens.WEETH.symbol, {
    token: sdk.tokens.WEETH
  });
  graph.setNode(sdk.tokens.WBTC.symbol, {
    token: sdk.tokens.WBTC
  });
  graph.setNode(sdk.tokens.BEAN.symbol, {
    token: sdk.tokens.BEAN
  });
  graph.setNode(sdk.tokens.USDT.symbol, {
    token: sdk.tokens.USDT
  });
  graph.setNode(sdk.tokens.USDC.symbol, {
    token: sdk.tokens.USDC
  });
  graph.setNode(sdk.tokens.DAI.symbol, {
    token: sdk.tokens.DAI
  });

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

  // BEAN<>WETH via Basin Well
  // graph.setEdge("BEAN", "WETH", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.wellSwap(
  //       sdk.pools.BEAN_ETH_WELL,
  //       sdk.tokens.BEAN,
  //       sdk.tokens.WETH,
  //       account,
  //       from,
  //       to
  //     ),
  //   from: "BEAN",
  //   to: "WETH"
  // });

  // graph.setEdge("WETH", "BEAN", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.wellSwap(
  //       sdk.pools.BEAN_ETH_WELL,
  //       sdk.tokens.WETH,
  //       sdk.tokens.BEAN,
  //       account,
  //       from,
  //       to
  //     ),
  //   from: "WETH",
  //   to: "BEAN"
  // });

  // set BasinWell.tokens[0] <> BasinWell.tokens[1] for Basin Well swaps
  sdk.pools.wells.forEach((well) => {
    setBiDirectionalWellSwapEdges(sdk, graph, well);
  });

  // BEAN<>wstETH via Basin Well
  // graph.setEdge("BEAN", "wstETH", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.wellSwap(
  //       sdk.pools.BEAN_WSTETH_WELL,
  //       sdk.tokens.BEAN,
  //       sdk.tokens.WSTETH,
  //       account,
  //       from,
  //       to
  //     ),
  //   from: "BEAN",
  //   to: "wstETH"
  // });

  // graph.setEdge("wstETH", "BEAN", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.wellSwap(
  //       sdk.pools.BEAN_WSTETH_WELL,
  //       sdk.tokens.WSTETH,
  //       sdk.tokens.BEAN,
  //       account,
  //       from,
  //       to
  //     ),
  //   from: "wstETH",
  //   to: "BEAN"
  // });

  // USDC<>WETH via Uniswap V3
  // graph.setEdge("USDC", "WETH", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.uniswapV3Swap(sdk.tokens.USDC, sdk.tokens.WETH, account, 500, from, to),
  //   from: "USDC",
  //   to: "WETH"
  // });

  // graph.setEdge("WETH", "USDC", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.uniswapV3Swap(sdk.tokens.WETH, sdk.tokens.USDC, account, 500, from, to),
  //   from: "WETH",
  //   to: "USDC"
  // });

  // DAI<>WETH via Uniswap V3
  // graph.setEdge("DAI", "WETH", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.uniswapV3Swap(sdk.tokens.DAI, sdk.tokens.WETH, account, 500, from, to),
  //   from: "DAI",
  //   to: "WETH"
  // });

  // graph.setEdge("WETH", "DAI", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.uniswapV3Swap(sdk.tokens.WETH, sdk.tokens.DAI, account, 500, from, to),
  //   from: "WETH",
  //   to: "DAI"
  // });

  // WETH<>WSTETH
  // graph.setEdge("WETH", "wstETH", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.uniswapV3Swap(sdk.tokens.WETH, sdk.tokens.WSTETH, account, 100, from, to),
  //   from: "WETH",
  //   to: "wstETH"
  // });
  // graph.setEdge("wstETH", "WETH", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.uniswapV3Swap(sdk.tokens.WSTETH, sdk.tokens.WETH, account, 100, from, to),
  //   from: "wstETH",
  //   to: "WETH"
  // });

  // BEAN<>Stables
  // [sdk.tokens.DAI, sdk.tokens.USDC, sdk.tokens.USDT].forEach((token) => {
  //   graph.setEdge("BEAN", token.symbol, {
  //     build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //       sdk.farm.presets.bean2Stable(token, account, from, to),
  //     from: "BEAN",
  //     to: token.symbol
  //   });
  //   graph.setEdge(token.symbol, "BEAN", {
  //     build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //       sdk.farm.presets.stable2Bean(token, account, from, to),
  //     from: token.symbol,
  //     to: "BEAN"
  //   });
  // });

  // graph.setEdge("BEAN", "WETH", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.wellSwapUniV3(
  //       sdk.pools.BEAN_WSTETH_WELL,
  //       account,
  //       sdk.tokens.BEAN,
  //       sdk.tokens.WSTETH,
  //       sdk.tokens.WETH,
  //       100,
  //       from,
  //       to
  //     ),
  //   from: "BEAN",
  //   to: "WETH"
  // });

  // graph.setEdge("WETH", "BEAN", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.uniV3WellSwap(
  //       sdk.pools.BEAN_WSTETH_WELL,
  //       account,
  //       sdk.tokens.WETH,
  //       sdk.tokens.WSTETH,
  //       sdk.tokens.BEAN,
  //       100,
  //       from,
  //       to
  //     ),
  //   from: "WETH",
  //   to: "BEAN"
  // });

  /// 3CRV<>Stables via 3Pool Add/Remove Liquidity

  // HEADS UP: the ordering of these tokens needs to match their indexing in the 3CRV LP token.
  // Should be: 0 = DAI, 1 = USDC, 2 = USDT.
  // [sdk.tokens.DAI, sdk.tokens.USDC, sdk.tokens.USDT].forEach((token, index) => {
  //   setBidirectionalAddRemoveLiquidityEdges(
  //     sdk,
  //     graph,
  //     sdk.contracts.curve.pools.pool3.address,
  //     sdk.contracts.curve.registries.poolRegistry.address,
  //     sdk.tokens.CRV3, // LP token
  //     token, // underlying token
  //     index
  //   );
  // });

  ////// 3Pool Exchanges

  /// USDC<>USDT via 3Pool Exchange

  // setBidirectionalExchangeEdges(
  //   sdk,
  //   graph,
  //   sdk.contracts.curve.pools.pool3.address,
  //   sdk.contracts.curve.registries.poolRegistry.address,
  //   sdk.tokens.USDC,
  //   sdk.tokens.USDT
  // );

  /// USDC<>DAI via 3Pool Exchange

  // setBidirectionalExchangeEdges(
  //   sdk,
  //   graph,
  //   sdk.contracts.curve.pools.pool3.address,
  //   sdk.contracts.curve.registries.poolRegistry.address,
  //   sdk.tokens.USDC,
  //   sdk.tokens.DAI
  // );

  /// USDT<>DAI via 3Pool Exchange

  // setBidirectionalExchangeEdges(
  //   sdk,
  //   graph,
  //   sdk.contracts.curve.pools.pool3.address,
  //   sdk.contracts.curve.registries.poolRegistry.address,
  //   sdk.tokens.USDT,
  //   sdk.tokens.DAI
  // );

  return graph;
};

// RE-add these when BEAN<>WETH has more liquidity
//BEAN<>USDC via Pipeline
// graph.setEdge("USDC", "BEAN", {
//   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
//     sdk.farm.presets.uniV3WellSwap(
//       sdk.pools.BEAN_ETH_WELL,
//       account,
//       sdk.tokens.USDC,
//       sdk.tokens.WETH,
//       sdk.tokens.BEAN,
//       500,
//       from,
//       to
//     ),
//   from: "USDC",
//   to: "BEAN"
// });

// graph.setEdge("BEAN", "USDC", {
//   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
//     sdk.farm.presets.wellSwapUniV3(
//       sdk.pools.BEAN_ETH_WELL,
//       account,
//       sdk.tokens.BEAN,
//       sdk.tokens.WETH,
//       sdk.tokens.USDC,
//       500,
//       from,
//       to
//     ),
//   from: "BEAN",
//   to: "USDC"
// });

//BEAN<>DAI via Pipeline
// graph.setEdge("DAI", "BEAN", {
//   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
//     sdk.farm.presets.uniV3WellSwap(
//       sdk.pools.BEAN_ETH_WELL,
//       account,
//       sdk.tokens.DAI,
//       sdk.tokens.WETH,
//       sdk.tokens.BEAN,
//       500,
//       from,
//       to
//     ),
//   from: "DAI",
//   to: "BEAN"
// });

// graph.setEdge("BEAN", "DAI", {
//   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
//     sdk.farm.presets.wellSwapUniV3(
//       sdk.pools.BEAN_ETH_WELL,
//       account,
//       sdk.tokens.BEAN,
//       sdk.tokens.WETH,
//       sdk.tokens.DAI,
//       500,
//       from,
//       to
//     ),
//   from: "BEAN",
//   to: "DAI"
// });
