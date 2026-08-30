import type { Token } from "@beanstalk/sdk-core";
import { Graph as GraphLib, alg } from "graphlib";
import type { Well } from "../Well";

export class Graph {
  graph: GraphLib;

  constructor() {
    this.graph = new GraphLib({
      multigraph: true,
      directed: true,
      compound: false
    });
  }

  getTokenKey(token: Token) {
    const address = token.address || `native:${token.symbol.toLowerCase()}`;
    return `${token.chainId}:${address.toLowerCase()}`;
  }

  addNode(token: Token) {
    const key = this.getTokenKey(token);
    if (this.graph.hasNode(key)) return;
    this.graph.setNode(key, { token });
  }

  addEdge(tokenA: Token, tokenB: Token, well?: Well) {
    this.graph.setEdge(this.getTokenKey(tokenA), this.getTokenKey(tokenB), {
      well,
      from: tokenA,
      to: tokenB
    });
  }

  searchGraph(startToken: Token, endToken: Token): string[] {
    const path: string[] = [];
    const start = this.getTokenKey(startToken);
    const end = this.getTokenKey(endToken);
    let res = alg.dijkstra(this.graph, start);

    // target not found
    if (!res[end]) return [];
    // sournce not found
    if (!res[start]) return [];

    let endStep = res[end];
    if (endStep.distance === Infinity) return [];

    path.push(end);
    while (endStep.distance > 0) {
      path.push(endStep.predecessor);
      endStep = res[endStep.predecessor];
    }
    path.reverse();

    return path;
  }
}
