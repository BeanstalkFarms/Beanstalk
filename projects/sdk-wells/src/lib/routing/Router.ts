import { Token } from "@beanstalk/sdk-core";
import { Well } from "../Well";
import { Graph } from "./Graph";
import { Route } from "./Route";
import { WellsSDK } from "../WellsSDK";

export class Router {
  private sdk: WellsSDK;
  public wells = new Set<Well>();
  public graph: Graph;

  constructor(sdk: WellsSDK) {
    this.sdk = sdk;
    this.graph = new Graph();
  }

  async addWell(well: Well) {
    if (this.wells.has(well)) return;

    const tokens = await well.getTokens();
    this.wells.add(well);

    let WETH;

    /**
     * Add the "nodes"
     * */
    for (const token of tokens) {
      token.setSignerOrProvider(this.sdk.providerOrSigner);
      this.graph.addNode(token);
      if (token.symbol === "WETH") WETH = token;
    }
    // Add ETH
    const ETH = this.sdk.tokens.ETH;
    ETH.setSignerOrProvider(this.sdk.providerOrSigner);
    this.graph.addNode(ETH);

    /**
     * Add the "edges"
     * We need to loop through all tokens in a well and generate
     * a list of all possible unique combinations
     */
    tokens.flatMap((token1, i) =>
      tokens.slice(i + 1).map((token2) => {
        this.graph.addEdge(token1, token2, well);
        this.graph.addEdge(token2, token1, well);
      })
    );

    // Add ETH <> WETH edges
    if (WETH) {
      this.graph.addEdge(ETH, WETH);
      this.graph.addEdge(WETH, ETH);
    }
  }

  getRoute(fromToken: Token, toToken: Token) {
    const route = new Route();

    let path = this.graph.searchGraph(fromToken.symbol, toToken.symbol);
    /**
     * At this point, path is an array of strings, for ex:
     * [ 'A', 'B', 'C', 'D' ]
     * We need to conver this to edges, ex
     * [ A/B, B/C, C/D]
     */

    // Length of 0 means there was no path found
    if (path.length === 0) {
      return route;
    }

    // Length of 1 means the source and target are the same node. This is not supported in a swap
    if (path.length === 1) {
      return route;
    }

    // Get the edges
    for (let i = 0; i < path.length - 1; i++) {
      route.addStep(this.graph.graph.edge(path[i], path[i + 1]));
    }

    return route;
  }

  getGraphCode() {
    let code = "// http://www.webgraphviz.com\ndigraph G {\n";

    this.graph.graph.edges().forEach((e) => {
      const edge = this.graph.graph.edge(e.v, e.w);
      const label = edge.label;
      const labelString = label ? ` [label="${label}"]` : "";
      code += `\t"${e.v}" -> "${e.w}"${labelString}\n`;
    });
    code += "}";

    return code;
  }
}
