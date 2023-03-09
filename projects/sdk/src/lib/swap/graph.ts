import { Graph } from "graphlib";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { FarmFromMode, FarmToMode } from "src/lib/farm";

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
  graph.setNode("USDT", { token: sdk.tokens.USDT });
  graph.setNode("USDC", { token: sdk.tokens.USDC });
  graph.setNode("DAI", { token: sdk.tokens.DAI });

  ////// Add Edges

  // ETH<>WETH
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

  // WETH<>USDT
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

  // USDT<>BEAN
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

  // USDC<>BEAN
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

  // DAI<>BEAN
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

  // CRV3<>BEAN
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

  /**
   * DO NOT TURN THIS ON YET. Doing so will FORCE all ETH<>BEAN trades
   * through the Well, and it may not be ready/have enough liquidity/etc...
   */
  // ////// Wells
  // // WETH <> BEAN
  // graph.setEdge("WETH", "BEAN", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.wellWethBean(sdk.tokens.WETH, sdk.tokens.BEAN, account, from, to),
  //   from: "WETH",
  //   to: "BEAN"
  // });
  // graph.setEdge("BEAN", "WETH", {
  //   build: (account: string, from: FarmFromMode, to: FarmToMode) =>
  //     sdk.farm.presets.wellWethBean(sdk.tokens.BEAN, sdk.tokens.WETH, account, from, to),
  //   from: "BEAN",
  //   to: "WETH"
  // });

  return graph;
};
