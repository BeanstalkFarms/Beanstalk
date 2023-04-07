import { Token } from "@beanstalk/sdk-core";
import { Well } from "../Well";

export type RouteLeg = {
  from: Token;
  to: Token;
  well: Well;
};

type SelfEdgeBuilder = (token: string) => RouteLeg;

export class Route {
  private readonly steps: RouteLeg[] = [];

  addStep(step: RouteLeg) {
    this.steps.push(step);
  }

  getStep(index: number): RouteLeg {
    return this.steps[index];
  }

  toArray(): string[] {
    return this.steps.reduce<string[]>((s, curr, i) => {
      if (i == 0) {
        return [curr.from.symbol, curr.to.symbol];
      } else {
        s.push(curr.to.symbol);
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
