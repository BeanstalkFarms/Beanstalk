import { Graph } from "graphlib";
import { ERC20Token, Token } from "src/classes/Token";
import { CurveMetaPool } from "src/classes/Pool/CurveMetaPool";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { FarmFromMode, FarmToMode } from "src/lib/farm";
import { setBidirectionalAddRemoveLiquidityEdges } from "../swap/graph";

export const getDepositGraph = (sdk: BeanstalkSDK): Graph => {
  const whitelist: string[] = [];

  // Build an array of the whitelisted token symbols
  for (const token of sdk.tokens.siloWhitelist) {
    whitelist.push(token.symbol);
  }

  // initialize the graph data structure
  const graph: Graph = new Graph({
    multigraph: true,
    directed: true,
    compound: false
  });

  /**
   * ********** NODES ***************
   */

  /**
   * These are the whitelisted assets that we're allowed to deposit
   *
   * Basically:
   * graph.setNode("BEAN");
   * graph.setNode("urBEAN");
   * graph.setNode("urBEANwstETH");
   * graph.setNode("BEANETH");
   * graph.setNode("BEANwstETH");
   */

  for (const token of sdk.tokens.siloWhitelist) {
    graph.setNode(token.symbol);
  }

  /**
   * Deposit targets, ie "{TOKEN}:SILO" . (":SILO" is just a convention)
   *
   * These are different than, but correspond to, the whitelisted assets. There's a
   * difference between swapping to an asset, and depositing it.
   *
   * For ex, if someone wants to deposit BEAN into the "BEAN:wstETH LP" silo, the
   * steps would be:
   * 1. deposit BEAN into the BEAN:wstETH Well on Basin to receive the BEAN:wstETH LP token
   * 2. deposit the BEAN:wstETH LP token into Beanstalk
   *
   * Therefore we need two nodes related to BEAN:wstETH. One that is the token,
   * and one that is a deposit target.
   *
   * For ex, this graph:
   * USDC -> BEAN -> BEAN:SILO
   * allows us to create edges like this:
   * USDC -> BEAN        do a swap
   * BEAN -> BEAN:SILO   deposit into beanstalk using deposit()
   * which wouldn't be possible w/o two separate nodes representing BEAN and BEAN:SILO
   *
   * When using the SDK and someone creates a DepositOperation for a target token, for ex "BEAN",
   * we secretly set the end target graph node to "BEAN:SILO" instead.
   **/
  for (const token of sdk.tokens.siloWhitelist) {
    graph.setNode(`${token.symbol}:SILO`);
  }

  /**
   * Add other "nodes", aka Tokens that we allow as input
   * for deposit
   */
  graph.setNode("DAI");
  graph.setNode("USDC");
  graph.setNode("USDT");
  graph.setNode("WETH");
  graph.setNode("wstETH");
  graph.setNode("weETH");
  graph.setNode("WBTC");

  /**
   * ********** EDGES ***************
   */

  /**
   * Setup the deposit edges.
   * This is the last step of going from a whitelisted asset to depositing it.
   *
   * For ex, the edge BEAN -> BEAN:SILO runs "deposit()" method
   * We create a unique edge for each whitelisted asset between itself and its
   * corresponding {TOKEN}:SILO node
   */
  for (const token of sdk.tokens.siloWhitelist) {
    const from = token.symbol;
    const to = `${from}:SILO`;
    graph.setEdge(from, to, {
      build: (_: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
        new sdk.farm.actions.Deposit(token, fromMode),
      from,
      to,
      label: "deposit"
    });
  }

  /**
   * Setup edges to addLiquidity to non-unripe whitelisted well.
   *
   * Custom routes to avoid swaps to-from Bean
   *
   */
  {
    if (!sdk.pools?.wells) {
      throw new Error(`sdk.pools.wells no initialized`);
    }

    sdk.pools.wells.forEach((well) => {
      well.tokens.forEach((tokenIn) => {
        graph.setEdge(tokenIn.symbol, well.lpToken.symbol, {
          build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
            sdk.farm.presets.wellAddLiquidity(well, tokenIn, account, fromMode, toMode),
          from: tokenIn.symbol,
          to: well.lpToken.symbol,
          label: "wellAddLiquidity"
        });
      });
    });
  }
  /**
   * Setup edges to addLiquidity to BEAN:ETH Well.
   *
   * Custom routes to avoid swaps to-from Bean
   *
   * BEAN / ETH / USDC / USDT / DAI => BEAN_ETH_LP
   */

  {
    // const beanEthLP = sdk.tokens.BEAN_ETH_WELL_LP;
    // const beanEthWell = sdk.pools.BEAN_ETH_WELL;
    // if (!beanEthWell) throw new Error(`Pool not found for LP token: ${beanEthLP.symbol}`);
    // Add edges for each well's underlying tokens => well's LP token
    // BEAN / ETH => BEAN_ETH_LP
    // [sdk.tokens.BEAN, sdk.tokens.WETH].forEach((from: ERC20Token) => {
    //   graph.setEdge(from.symbol, beanEthLP.symbol, {
    //     build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
    //       sdk.farm.presets.wellAddLiquidity(beanEthWell, from, account, fromMode, toMode),
    //     from: from.symbol,
    //     to: beanEthLP.symbol,
    //     label: "wellAddLiquidity"
    //   });
    // });
    // USDC => BEAN_ETH_LP
    // graph.setEdge(sdk.tokens.USDC.symbol, beanEthLP.symbol, {
    //   build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
    //     sdk.farm.presets.usdc2beaneth(beanEthWell, account, fromMode, toMode),
    //   from: sdk.tokens.USDC.symbol,
    //   to: beanEthLP.symbol,
    //   label: "swap2weth,deposit"
    // });
    // USDT => BEAN_ETH_LP
    // graph.setEdge(sdk.tokens.USDT.symbol, beanEthLP.symbol, {
    //   build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
    //     sdk.farm.presets.usdt2beaneth(beanEthWell, account, fromMode, toMode),
    //   from: sdk.tokens.USDT.symbol,
    //   to: beanEthLP.symbol,
    //   label: "swap2weth,deposit"
    // });
    // DAI => BEAN_ETH_LP
    // graph.setEdge(sdk.tokens.DAI.symbol, beanEthLP.symbol, {
    //   build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
    //     sdk.farm.presets.dai2beaneth(beanEthWell, account, fromMode, toMode),
    //   from: sdk.tokens.DAI.symbol,
    //   to: beanEthLP.symbol,
    //   label: "swap2weth,deposit"
    // });
  }

  /**
   * Handle WETH / ETH
   */
  {
    graph.setEdge("ETH", "WETH", {
      build: (_: string, _2: FarmFromMode, to: FarmToMode) => new sdk.farm.actions.WrapEth(to),
      from: "ETH",
      to: "WETH",
      label: "wrapEth"
    });
  }

  /**
   * [ USDT, USDC, DAI ] => WETH
   */
  {
    // graph.setEdge("USDT", "WETH", {
    //   build: (_: string, from: FarmFromMode, to: FarmToMode) =>
    //     sdk.farm.presets.usdt2weth(from, to),
    //   from: "USDT",
    //   to: "WETH",
    //   label: "exchange"
    // });
    // graph.setEdge("USDC", "WETH", {
    //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
    //     sdk.farm.presets.uniswapV3Swap(sdk.tokens.USDC, sdk.tokens.WETH, account, 500, from, to),
    //   from: "USDC",
    //   to: "WETH",
    //   label: "uniswapV3Swap"
    // });
    // graph.setEdge("DAI", "WETH", {
    //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
    //     sdk.farm.presets.uniswapV3Swap(sdk.tokens.DAI, sdk.tokens.WETH, account, 500, from, to),
    //   from: "DAI",
    //   to: "WETH",
    //   label: "uniswapV3Swap"
    // });
  }

  /**
   * [ USDC, DAI, USDT ] => BEAN
   */
  {
    // [sdk.tokens.DAI, sdk.tokens.USDC, sdk.tokens.USDT].forEach((token) => {
    //   graph.setEdge(token.symbol, "BEAN", {
    //     build: (account: string, from: FarmFromMode, to: FarmToMode) =>
    //       sdk.farm.presets.stable2Bean(token, account, from, to),
    //     from: token.symbol,
    //     to: "BEAN"
    //   });
    // });
  }

  /**
   * Well Swap: WETH <> BEAN
   */
  {
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
    //   to: "BEAN",
    //   label: "wellSwap"
    // });
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
    //   to: "WETH",
    //   label: "wellSwap"
    // });
  }

  /**
   * Well Swap: WETH <> BEAN
   */
  {
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
    //   to: "BEAN",
    //   label: "wellSwap"
    // });
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
    //   to: "wstETH",
    //   label: "wellSwap"
    // });
  }

  /**
   * set edges for WETH <> wstETH
   */
  {
    // graph.setEdge("WETH", "wstETH", {
    //   build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
    //     sdk.farm.presets.uniswapV3Swap(
    //       sdk.tokens.WETH,
    //       sdk.tokens.WSTETH,
    //       account,
    //       100,
    //       fromMode,
    //       toMode
    //     ),
    //   from: "WETH",
    //   to: "wstETH",
    //   label: "uniswapV3Swap"
    // });
    // graph.setEdge("wstETH", "WETH", {
    //   build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
    //     sdk.farm.presets.uniswapV3Swap(
    //       sdk.tokens.WSTETH,
    //       sdk.tokens.WETH,
    //       account,
    //       100,
    //       fromMode,
    //       toMode
    //     ),
    //   from: "wstETH",
    //   to: "WETH",
    //   label: "uniswapV3Swap"
    // });
  }

  /**
   * set up edges for depositing to BEAN:WSTETH Well;
   */
  {
    // const beanWstethWell = sdk.pools.BEAN_WSTETH_WELL;
    // const beanWstethLP = sdk.tokens.BEAN_WSTETH_WELL_LP;
    // if (!beanWstethWell) throw new Error(`Pool not found for LP token: ${beanWstethLP.symbol}`);
    // // BEAN/wstETH<> BEAN_wstETH_LP
    // [sdk.tokens.BEAN, sdk.tokens.WSTETH].forEach((from: ERC20Token) => {
    //   graph.setEdge(from.symbol, beanWstethLP.symbol, {
    //     build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
    //       sdk.farm.presets.wellAddLiquidity(beanWstethWell, from, account, fromMode, toMode),
    //     from: from.symbol,
    //     to: beanWstethLP.symbol,
    //     label: "wellAddLiquidity"
    //   });
    // });
    // // [USDC/USDT/DAI] -> bean:wstETH
    // [sdk.tokens.USDC, sdk.tokens.USDT, sdk.tokens.DAI].forEach((token) => {
    //   graph.setEdge(token.symbol, sdk.tokens.BEAN_WSTETH_WELL_LP.symbol, {
    //     build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
    //       sdk.farm.presets.stable2beanWstETH(token, account, fromMode, toMode),
    //     from: token.symbol,
    //     to: sdk.tokens.BEAN_WSTETH_WELL_LP.symbol,
    //     label: "stable2bean:wstETH"
    //   });
    // });
  }

  /**
   * set edges for stables => wstETH
   */
  // {
  //   [sdk.tokens.USDC, sdk.tokens.USDT, sdk.tokens.DAI].forEach((token) => {
  //     graph.setEdge(token.symbol, "wstETH", {
  //       build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
  //         sdk.farm.presets.stable2wstETH(token, account, fromMode, toMode),
  //       from: token.symbol,
  //       to: "wstETH",
  //       label: "2univ3stable2wstETH"
  //     });
  //   });
  // }

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

  // // WETH => 3CRV
  // // needed to force a path when depositing WETH > BEAN3CRV, so it doesn't go through BEAN
  // graph.setEdge("WETH", "3CRV", {
  //   build: (_: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.weth2bean3crv(from, to),
  //   from: "WETH",
  //   to: "3CRV",
  //   label: "swap2usdt23crv"
  // });

  return graph;
};

// remove these as bean:eth has low liquidity

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
//   to: "BEAN",
//   label: "uniV3WellSwap"
// });

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
//   to: "BEAN",
//   label: "uniV3WellSwap"
// });

/**
 * Setup edges to addLiquidity to BEAN:3CRV pool.
 *
 * [ BEAN, 3CRV ] => BEAN_CRV3_LP
 */
// {
//   const targetToken = sdk.tokens.BEAN_CRV3_LP;
//   const pool = sdk.pools.BEAN_CRV3;
//   if (!pool) throw new Error(`Pool not found for LP token: ${targetToken.symbol}`);
//   const registry = sdk.contracts.curve.registries.metaFactory.address;

//   [sdk.tokens.BEAN, sdk.tokens.CRV3].forEach((from: Token) => {
//     const indexes: [number, number] = [0, 0];
//     const tokenIndex = (pool as CurveMetaPool).getTokenIndex(from);
//     if (tokenIndex === -1) throw new Error(`Unable to find index for token ${from.symbol}`);
//     indexes[tokenIndex] = 1;
//     graph.setEdge(from.symbol, targetToken.symbol, {
//       build: (_: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
//         new sdk.farm.actions.AddLiquidity(pool.address, registry, indexes, fromMode, toMode),
//       from: from.symbol,
//       to: targetToken.symbol,
//       label: "addLiquidity"
//     });
//   });
// }

/**
 * Setup edges to removeLiquidityOneToken to Curve 3pool.
 *
 * 3CRV => USDT
 */
// {
//   const from = sdk.tokens.CRV3;
//   const targetToken = sdk.tokens.USDT;
//   const pool = sdk.contracts.curve.pools.pool3;
//   const registry = sdk.contracts.curve.registries.poolRegistry.address;
//   graph.setEdge(from.symbol, targetToken.symbol, {
//     build: (_: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
//       new sdk.farm.actions.RemoveLiquidityOneToken(
//         pool.address,
//         registry,
//         targetToken.address,
//         fromMode,
//         toMode
//       ),
//     from: from.symbol,
//     to: targetToken.symbol,
//     label: "removeLiquidityOneToken"
//   });
// }
