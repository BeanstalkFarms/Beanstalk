import { Token } from "@beanstalk/sdk-core";
import { Graph as GraphLib, alg } from "graphlib";
import { Well } from "../Well";

export class Graph {
  graph: GraphLib;
  private tokens: Set<Token> = new Set<Token>();

  constructor() {
    this.graph = new GraphLib({
      multigraph: true,
      directed: true,
      compound: false
    });
  }

  addNode(token: Token) {
    if (this.tokens.has(token)) return;
    this.graph.setNode(token.symbol, { token });
    this.tokens.add(token);
  }

  addEdge(tokenA: Token, tokenB: Token, well: Well) {
    this.graph.setEdge(tokenA.symbol, tokenB.symbol, {
      well,
      from: tokenA,
      to: tokenB
    });
  }

  searchGraph(start: string, end: string): string[] {
    const path: string[] = [];
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
