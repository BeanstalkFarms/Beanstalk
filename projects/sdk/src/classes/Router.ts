import { Graph, alg } from "graphlib";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { Token } from "src/classes/Token";
import { FarmFromMode, FarmToMode } from "src/lib/farm/types";
import { StepClass } from "src/classes/Workflow";

export type RouteStep = {
  build: (account: string, fromMode?: FarmFromMode, toMode?: FarmToMode) => StepClass;
  from: string;
  to: string;
};

type SelfEdgeBuilder = (token: string) => RouteStep;

export class Route {
  private readonly steps: RouteStep[] = [];

  addStep(step: RouteStep) {
    this.steps.push(step);
  }

  getStep(index: number): RouteStep {
    return this.steps[index];
  }

  toArray(): string[] {
    return this.steps.reduce<string[]>((s, curr, i) => {
      if (i == 0) {
        return [curr.from, curr.to];
      } else {
        s.push(curr.to);
        return s;
      }
    }, []);
  }

  toString(separator: string = " -> ") {
    return this.steps.reduce<string>((s, curr, i) => {
      if (i == 0) {
        return `${curr.from}${separator}${curr.to}`;
      } else {
        return `${s}${separator}${curr.to}`;
      }
    }, "");
  }

  get length() {
    return this.steps.length;
  }

  [Symbol.iterator]() {
    return this.steps[Symbol.iterator]();
  }
}

export class Router {
  private static sdk: BeanstalkSDK;
  private graph: Graph;
  private buildSelfEdge: SelfEdgeBuilder;

  constructor(sdk: BeanstalkSDK, graph: Graph, selfEdgeBuilder: SelfEdgeBuilder) {
    Router.sdk = sdk;
    this.graph = graph;
    this.buildSelfEdge = selfEdgeBuilder;
  }

  public getRoute(tokenIn: string, tokenOut: string): Route {
    const route = new Route();

    let path = this.searchGraph(tokenIn, tokenOut);
    // At this point, path is an array of strings, for ex:
    // [ 'A', 'B', 'C', 'D' ]
    // We need to conver this to an array of edges (aka steps) (wrapped in Route class),
    // by getting the edges of these pairs. ex:
    // [ A/B, B/C, C/D]

    // Length of 0 means there was no path found
    if (path.length === 0) {
      Router.sdk.debug(`Router.getRoute: No path found from ${tokenIn}->${tokenOut}`);
      return route;
    }

    // Length of 1 means the source and target are the same node,
    // for ex, swap BEAN to BEAN, or deposit BEAN to BEAN.
    // This is a special case; we must use the same "edge" for all nodes.
    // For ex, in a swap, we use a 'transfer()' action
    // in a deposit graph, we use addLiquidity. We refer to this as the "selfEdge"
    // and it must be passed in during Router instantiation.
    if (path.length === 1) {
      // If there's a "self edge" use it, otherwise default to generic
      // sanity check, tokenIn should be tokenOut
      if (path[0] !== tokenIn && tokenIn !== tokenOut) {
        throw new Error("Router graph error; path has length of 1 but tokens are not the same");
      }
      const edge = this.graph.edge(path[0], path[0]);
      if (edge) {
        route.addStep(edge);
      } else {
        route.addStep(this.buildSelfEdge(tokenIn));
      }
      Router.sdk.debug(`Router.getRoute: ${route}`);
      return route;
    }

    // Get the edges
    for (let i = 0; i < path.length - 1; i++) {
      route.addStep(this.graph.edge(path[i], path[i + 1]));
    }
    Router.sdk.debug(`Router.getRoute: ${route}`);
    return route;
  }

  private searchGraph(start: string, end: string): string[] {
    const path: string[] = [];
    let res = alg.dijkstra(this.graph, start);
    // console.log(`Search Results [${start}->${end}]: `, res);
    Router.sdk.debug(`[Router.searchGraph()]`, { start, end, results: res });

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

  getGraphCode() {
    let code = "// http://www.webgraphviz.com\ndigraph G {\n";
    Router.sdk.tokens.siloWhitelist.forEach((t) => {
      code += `\t"${t.symbol}:SILO" [fillColor="#afb8ff" style="filled"]\n`;
    });
    this.graph.edges().forEach((e) => {
      const edge = this.graph.edge(e.v, e.w);
      const label = edge.label;
      const labelString = label ? ` [label="${label}"]` : "";
      code += `\t"${e.v}" -> "${e.w}"${labelString}\n`;
    });
    code += "}";

    return code;
  }
}
