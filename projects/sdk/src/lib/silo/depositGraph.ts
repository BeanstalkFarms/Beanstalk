import { Graph } from "graphlib";
import { Token } from "src/classes/Token";
import { CurveMetaPool } from "src/classes/Pool/CurveMetaPool";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { FarmFromMode, FarmToMode } from "src/lib/farm";

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
   * graph.setNode("BEAN3CRV");
   * graph.setNode("urBEAN");
   * graph.setNode("urBEAN3CRV");
   * graph.setNode("BEANETH");
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
   * For ex, if someone wants to deposit BEAN into the "BEAN:3CRV LP" silo, the
   * steps would be:
   * 1. deposit BEAN into the BEAN3CRV pool on Curve to receive the BEAN3CRV LP token
   * 2. deposit the BEAN3CRV LP token into Beanstalk
   *
   * Therefor we need two nodes related to BEAN3CRV. One that is the token,
   * and one that is a deposit target.
   *
   * For ex, this graph:
   * USDC -> BEAN -> BEAN:SILO
   * allows us to create edges like this:
   * USDC -> BEAN        do a swap using exchangeUnderlying()
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
  graph.setNode("3CRV");
  graph.setNode("WETH");

  // graph.setNode("ETH");

  /**
   * ********** EDGES ***************
   */

  /**
   * Setup the deposit edges.
   * This is the last step of going from a whitelisted asset to depositing it.
   *
   * For ex, the edge BEAN -> BEAN:SILO runs "deposit()" method
   * We create a unique edge for each whitelisted asset between itself and its
   * correpsondign {TOKEN}:SILO node
   */
  for (const token of sdk.tokens.siloWhitelist) {
    const from = token.symbol;
    const to = `${from}:SILO`;
    graph.setEdge(from, to, {
      build: (_: string, fromMode: FarmFromMode, toMode: FarmToMode) => new sdk.farm.actions.Deposit(token, fromMode),
      from,
      to,
      label: "deposit"
    });
  }

  /**
   * Setup edges to addLiquidity to BEAN:3CRV pool.
   *
   * [ BEAN, 3CRV ] => BEAN_CRV3_LP
   */
  {
    const targetToken = sdk.tokens.BEAN_CRV3_LP;
    const pool = sdk.pools.BEAN_CRV3;
    if (!pool) throw new Error(`Pool not found for LP token: ${targetToken.symbol}`);
    const registry = sdk.contracts.curve.registries.metaFactory.address;

    [sdk.tokens.BEAN, sdk.tokens.CRV3].forEach((from: Token) => {
      const indexes: [number, number] = [0, 0];
      const tokenIndex = (pool as CurveMetaPool).getTokenIndex(from);
      if (tokenIndex === -1) throw new Error(`Unable to find index for token ${from.symbol}`);
      indexes[tokenIndex] = 1;
      graph.setEdge(from.symbol, targetToken.symbol, {
        build: (_: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
          new sdk.farm.actions.AddLiquidity(pool.address, registry, indexes, fromMode, toMode),
        from: from.symbol,
        to: targetToken.symbol,
        label: "addLiquidity"
      });
    });
  }

  /**
   * Setup edges to addLiquidity to BEAN:ETH Well.
   *
   * [ BEAN, WETH ] => BEAN_ETH_LP
   */
  {
    const from = sdk.tokens.WETH;
    const targetToken = sdk.tokens.BEAN_ETH_WELL_LP;
    const well = sdk.pools.BEAN_ETH_WELL;
    if (!well) throw new Error(`Pool not found for LP token: ${targetToken.symbol}`);
      graph.setEdge(from.symbol, targetToken.symbol, {
        build: (account: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
          sdk.farm.presets.wellAddLiquidity(well, from, account, fromMode, toMode),
        from: from.symbol,
        to: targetToken.symbol,
      });
  }

  /**
   * Setup edges to addLiquidity to Curve 3pool.
   *
   * [ DAI, USDC, USDT ] => 3CRV
   */
  {
    const targetToken = sdk.tokens.CRV3;
    const pool = sdk.contracts.curve.pools.pool3;
    const registry = sdk.contracts.curve.registries.poolRegistry.address;

    [sdk.tokens.DAI, sdk.tokens.USDC, sdk.tokens.USDT].forEach((from: Token) => {
      const indexes: [number, number, number] = [0, 0, 0];
      const tokenIndex = sdk.pools.BEAN_CRV3.getTokenIndex(from);
      if (tokenIndex === -1) throw new Error(`Unable to find index for token ${from.symbol}`);
      indexes[tokenIndex - 1] = 1;
      graph.setEdge(from.symbol, targetToken.symbol, {
        build: (_: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
          new sdk.farm.actions.AddLiquidity(pool.address, registry, indexes, fromMode, toMode),
        from: from.symbol,
        to: targetToken.symbol,
        label: "addLiquidity"
      });
    });
  }

  /**
   * Setup edges to removeLiquidityOneToken to Curve 3pool.
   *
   * 3CRV => USDT
   */
  {
    const from = sdk.tokens.CRV3;
    const targetToken = sdk.tokens.USDT;
    const pool = sdk.contracts.curve.pools.pool3;
    const registry = sdk.contracts.curve.registries.poolRegistry.address;
    graph.setEdge(from.symbol, targetToken.symbol, {
      build: (_: string, fromMode: FarmFromMode, toMode: FarmToMode) =>
        new sdk.farm.actions.RemoveLiquidityOneToken(pool.address, registry, targetToken.address, fromMode, toMode),
      from: from.symbol,
      to: targetToken.symbol,
      label: "removeLiquidityOneToken"
    });
  }

  /**
   * Handle WETH / ETH
   */
  {
    graph.setEdge("WETH", "USDT", {
      build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.weth2usdt(from, to),
      from: "WETH",
      to: "USDT",
      label: "exchange"
    });

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
    graph.setEdge("USDT", "WETH", {
      build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.usdt2weth(from, to),
      from: "USDT",
      to: "WETH",
      label: "exchange"
    });

    graph.setEdge("USDC", "WETH", {
      build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.usdc2weth(from, to),
      from: "USDC",
      to: "WETH",
      label: "exchange"
    });

    graph.setEdge("DAI", "WETH", {
      build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.dai2weth(from, to),
      from: "DAI",
      to: "WETH",
      label: "exchange"
    });
  }

  {
    /**
     * Handle Other swaps to BEAN
     */
    graph.setEdge("USDT", "BEAN", {
      build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.usdt2bean(from, to),
      from: "USDT",
      to: "BEAN"
    });

    graph.setEdge("USDC", "BEAN", {
      build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.usdc2bean(from, to),
      from: "USDC",
      to: "BEAN"
    });

    graph.setEdge("DAI", "BEAN", {
      build: (_: string, from: FarmFromMode, to: FarmToMode) => sdk.farm.presets.dai2bean(from, to),
      from: "DAI",
      to: "BEAN"
    });
  }

  /**
   * WETH <=> BEAN routes through Curve pool
   */
   {
     graph.setEdge("WETH", "BEAN", {
       build: (_: string, from: FarmFromMode, to: FarmToMode) =>
         sdk.farm.presets.weth2bean(from, to),
       from: "WETH",
       to: "BEAN"
     });
     graph.setEdge("BEAN", "WETH", {
       build: (_: string, from: FarmFromMode, to: FarmToMode) =>
         sdk.farm.presets.bean2weth(from, to),
       from: "BEAN",
       to: "WETH"
     });
   }



  /**
   * DO NOT TURN THIS ON YET. Doing so will FORCE all ETH<>BEAN trades
   * through the Well, and it may not be ready/have enough liquidity/etc...
   */
  // /**
  //  * Well Swap: WETH => BEAN
  //  */
  // {
  //   graph.setEdge("WETH", "BEAN", {
  //     build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //       sdk.farm.presets.wellWethBean(sdk.tokens.WETH, sdk.tokens.BEAN, account, from, to),
  //     from: "WETH",
  //     to: "BEAN"
  //   });
  //   graph.setEdge("BEAN", "WETH", {
  //     build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //       sdk.farm.presets.wellWethBean(sdk.tokens.BEAN, sdk.tokens.WETH, account, from, to),
  //     from: "BEAN",
  //     to: "WETH"
  //   });
  // }

  return graph;
};
