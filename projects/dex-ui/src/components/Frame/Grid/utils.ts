import { RefObject } from "react";
import throttle from "lodash/throttle";
import { liangBarsky } from "./lineIntersect";

export const debugPoint = (point: DOMPoint, id: string = "debugpoint", svgRef: RefObject<SVGSVGElement>) => {
  const el = svgRef.current?.getElementById(id);
  el?.setAttribute("cx", point.x.toString());
  el?.setAttribute("cy", point.y.toString());
};

export const debugLine = (end: DOMPoint, start: DOMPoint, svgRef: RefObject<SVGSVGElement>) => {
  if (!end || !start) return;
  const el = svgRef.current?.getElementById("debugline");

  el?.setAttribute("x1", start.x.toString());
  el?.setAttribute("y1", start.y.toString());
  el?.setAttribute("x2", end.x.toString());
  el?.setAttribute("y2", end.y.toString());
};

export const getCorners = (point: DOMPoint, obj: any) => {
  if (!point) {
    debugger;
  }
  if (point.y == obj.top) {
    if (point.x == obj.left) {
      // we are in the TL corner
      return [obj.tr, obj.bl];
    }
    if (point.x == obj.right) {
      // we are in the TR corner
      return [obj.tl, obj.br];
    }
    // we are somewere on the top line
    return [obj.tl, obj.tr];
  }
  if (point.y == obj.bottom) {
    if (point.x == obj.left) {
      // we are in the BL corner
      return [obj.br, obj.tl];
    }
    if (point.x == obj.right) {
      // we are in the BR corner
      return [obj.tr, obj.bl];
    }
    // we are somewere on the bottom line
    return [obj.bl, obj.br];
  }
  if (point.x == obj.left) {
    // we are on the left side. We already checked corners
    return [obj.tl, obj.bl];
  }
  if (point.x == obj.right) {
    // we are on the right side. We already checked corners
    return [obj.tr, obj.br];
  }
  return [];
};

export const arePointsColinear = (p1: DOMPoint, p2: DOMPoint) => p1.x == p2.x || p1.y == p2.y;

export const getClosestPoint = (target: DOMPoint, points: DOMPoint[]) => {
  let closest = points[0];
  let distance = 1e5;
  points.forEach((p) => {
    let d = dist(p, target);
    if (d! <= distance) {
      distance = d!;
      closest = p;
    }
  });

  return closest;
};

export const pointsEq = (p1: DOMPoint, p2: DOMPoint) => {
  if (!p1 || !p2) return false;

  return p1.x === p2.x && p1.y === p2.y;
};

export const isPointInBox = (p: DOMPoint, b: DOMRect) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

export const isPointOnBox = (p: DOMPoint, b: DOMRect) => p.x === b.left || p.x === b.right || p.y === b.top || p.y === b.bottom;

/**
 * Moves a point to the nearest spot on the grid
 */
export const snapToGrid = (pos: DOMPoint) => {
  const grid = 24;
  const quotientX = Math.floor(pos.x / grid);
  const remainderX = pos.x % grid;
  const x = remainderX >= grid / 2 ? quotientX + 1 : quotientX;
  const quotientY = Math.floor(pos.y / grid);
  const remainderY = pos.y % grid;
  const y = remainderY >= grid / 2 ? quotientY + 1 : quotientY;

  pos.x = x * grid;
  pos.y = y * grid;
};

/**
 * Mutates the `pos` parameter!
 * If there's points that would create a diagonal line, top-left to bottom right of a grid square,
 * this method flattens that line so we only get straight edges
 */
export const flattenDiagonals = (pos: DOMPoint, prev: DOMPoint) => {
  if (!prev) return;
  if (pos.x !== prev.x && pos.y !== prev.y) {
    const dx = Math.abs(pos.x - prev.x);
    const dy = Math.abs(pos.y - prev.y);
    if (dx >= dy) {
      pos.y = prev.y;
    } else {
      pos.x = prev.x;
    }
  }
};

export const getTraceables = throttle(
  (container: HTMLDivElement): DOMRect[] => {
    // Get all children of the container and find any that have a 'data-trace' attribtue
    const descendants = Array.from(container.querySelectorAll("*"));
    const elements = descendants.filter((e: Element) => e.getAttribute("data-trace") === "true");
    // for each one, return a DOMRect made up of its coordinates
    const traceables = elements.map((e) => {
      const el = e as HTMLElement;
      // use offsetLeft/Right here to get the position relative to 'parent', which should be the svg
      // this is a hacky assumption, but it should work if all pages follow the same structure
      const x = el.offsetLeft;
      const y = el.offsetTop;

      // Important. clientWidth/Height will get us the size without
      // borders, otherwise things don't line up with the grid
      const svgBox = new DOMRect(x, y, el.clientWidth, el.clientHeight);

      return svgBox;
    });

    return traceables;
  },
  1000,
  { leading: true }
);

export const getIntersection = (end: DOMPoint, start: DOMPoint, rect: DOMRect) => {
  if (!end || !start || !rect) return [];
  const bbox = [rect.x, rect.x + rect.width, rect.y, rect.y + rect.height];
  const res = liangBarsky(start.x, start.y, end.x, end.y, bbox);

  return res ?? [];
};

export const converToSvgPoint = (x: number, y: number, svg: SVGSVGElement): DOMPoint => {
  // Create a DOMPoint object from the coordinates
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  return pt.matrixTransform(svg.getScreenCTM()?.inverse());
};
export const dist = (p1: DOMPoint, p2: DOMPoint) => {
  if (!p1 || !p2) return null;
  const a = p1.x - p2.x;
  const b = p1.y - p2.y;
  const c = Math.sqrt(a * a + b * b);

  return c;
};
