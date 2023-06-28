import { RefObject, useEffect, useRef } from "react";
import { roundPathCorners } from "./roundCorners";
import throttle from "lodash/throttle";
import { Queue } from "./Queue";
import useRequestAnimationFrame from "./useAnimationFrame";
import {
  debugPoint,
  debugLine,
  getCorners,
  arePointsColinear,
  flattenDiagonals,
  getClosestPoint,
  isPointInBox,
  isPointOnBox,
  pointsEq,
  snapToGrid,
  getTraceables,
  converToSvgPoint,
  dist,
  getIntersection
} from "./utils";

const DEBUG = false;
const SHRINK = true;
const SHRINK_START_DELAY = 150;
const SHRINK_SPEED = 20;

export const useWiggle = (pathRef: RefObject<SVGPathElement>, svgRef: RefObject<SVGSVGElement>, contentEl: HTMLDivElement) => {
  // A FILO Queue to store the last N mouse positions
  const wiggleLinePointsRef = useRef<Queue<DOMPoint>>(new Queue(10));

  // to store the setTimeout for delaying the shrinking effect
  let shrinkTimeout: NodeJS.Timeout;

  // The possition of the mouse.
  // This will be in SVG coordinates, not browser
  let mouse: DOMPoint;

  // Start listening for mouse movements
  useEffect(() => {
    document.addEventListener("mousemove", mouseMove);
    return () => {
      document.removeEventListener("mousemove", mouseMove);
    };
  });

  // Adds a point to the queue, which effectively
  // "creates" the wiggle line (the 'animate()' method draws
  // these points)
  const addPoint = (point: DOMPoint) => {
    shrink(SHRINK_START_DELAY);
    const wiggleLine = wiggleLinePointsRef.current;
    const lastPoint = wiggleLine.last();

    // Ignore tiny mouse movements. Only add a new line point
    // if the user moves mouse a min distance
    const distance = dist(point, lastPoint);
    if (distance === null || distance >= 24) {
      wiggleLine.push(point);
    }
  };

  // Creates the line shrinking effect. There are TWO time values involved
  // here, depending on how shrink is called.
  // shink(A) should only be called ONCE, to represent the "start" of a new
  // shrink cycle, and shink(B), should be called after every removal.
  // We want to wait a tad longer (A) after the user stops moving the mouse, then wait
  // less (B) between each point being removed. This accomplishes both.
  const shrink = (delay: number) => {
    if (!SHRINK) return;
    clearTimeout(shrinkTimeout);
    shrinkTimeout = setTimeout(() => {
      wiggleLinePointsRef.current?.pop();
      shrink(SHRINK_SPEED);
    }, delay);
  };

  const mouseMove = throttle((e: MouseEvent) => {
    const svg = svgRef.current;
    const wiggleLine = wiggleLinePointsRef.current;
    const lastPoint = wiggleLine.last();

    if (!svg) return;
    // convert the mouse coordinate to SVG coordinate
    mouse = converToSvgPoint(e.clientX, e.clientY, svg);

    // snap to grid
    snapToGrid(mouse);

    // If the user is barely moving the mouse, exit
    // so we don't processes things un
    if (pointsEq(mouse, lastPoint)) {
      return;
    }

    // Get a list of all elements we should trace.
    // These need to be manually tagged with a `data-trace
    const traceables = getTraceables(contentEl, svg);

    DEBUG && debugPoint(mouse, "debugpoint", svgRef);
    DEBUG && debugLine(mouse, lastPoint, svgRef);
    let intersected = false;

    /**
     * Loop throught all traceables and trace the one that the mouse is interacting with, if any.
     * We are not just looking at the mouse position though; we need
     * to check if a line, between the last point and the current mouse, is intersecting
     * the rectangle of the object we need to trace. There could be 3 states that we need
     * to account for:
     * - use moved mouse super fast so the start and end of this line are outside the rect
     *   but crossing it in some way
     * - start is outside and ended inside the rectangle
     * - start is inside and end is outside
     */
    for (const object of traceables || []) {
      // This 3rd party code gives us the two points on our line that intersect
      // the rectangle, `entryPoint` and `exitPoint`.
      const inter = getIntersection(mouse, lastPoint, object);
      if (inter.length) {
        intersected = true;
        const entryPoint = new DOMPoint(inter[0][0], inter[0][1]);
        const exitPoint = new DOMPoint(inter[1][0], inter[1][1]);
        try {
          // We "draw" our trace between the two cross points, whereever they happen to be
          // on the rectangle
          const done = traceObject(object, mouse, entryPoint, exitPoint, wiggleLine);
          if (done) {
            // we finished tracing. Add one final point which will draw a line
            // from exitPoint to mouse

            flattenDiagonals(mouse, wiggleLine.last());
            addPoint(mouse);
          } else {
            // if we're here, i think it means the mouse is moving inside the rectangle
            // so we're effectively waiting for the user to exit so we get our exit point
          }
        } catch (err) {
          // TODO: low prio
          // This fixes some weird edge case error, but I forget what it is
          wiggleLine.items.pop();
        }
        // Debug the intersection
        if (DEBUG) {
          debugPoint(entryPoint, "start", svgRef);
          debugPoint(exitPoint, "end", svgRef);
        }

        // Break out of the loop, we found and processed an intersection
        break;
      }
    }

    // If no intersection was found, then we simply add a new mouse point
    // to the wiggle line.
    if (!intersected) {
      // make sure the new point is not diagonal
      flattenDiagonals(mouse, lastPoint);
      addPoint(mouse);
    }
  }, 20); // <-- THIS IS IMPORTANT: It affects the "resolution" of the path

  // Every 60FPS, take the mouse position data from the Queue
  // and manually create an SVG `<path>` from it.
  const animate = (_: number) => {
    const path = pathRef.current;
    const wiggleLine = wiggleLinePointsRef.current;
    if (!path || !wiggleLine) return;

    let pathData = "";
    const points = wiggleLine.items as DOMPoint[];
    for (const [i, point] of points.entries()) {
      const { x, y } = point;
      if (i == 0) {
        // First point, we start with Move command
        pathData = `M ${x} ${y}`;
      } else {
        // the rest, we simply do a Line command
        pathData = `${pathData} L ${x} ${y}`;
      }
    }

    // Process path and covert corners to rounded corners
    const roundedPathData = roundPathCorners(pathData, 4.5, false);

    // Draw it
    path.setAttribute("d", roundedPathData);
  };

  /**
   * Algo for "walking" around a rectangle.
   *
   * The term "mouse line" is a virtual line between the _last_ and _current_ mouse
   * position. A slow mouse move creatse a short "mouse lines". A fast mouse movement will
   * produce a long "mouse line".
   *
   * We have two points that correspond to where the mouse line is intersecting the rectangle
   * entryPoint and exitPoint. Mouse line and cross points could be in these states:
   *   A: mouse line has just moved into the rectangle, entry/exit points are overlapped on
   *      the single touch point
   *   B: mouse line is fully within the rectangle, entry/exit points are both inside
   *   C: mouse line has just moved out of the rectangle, entry/exit are overlapped on
   *      the single touch point
   *   D: mouse line fully crosses the rectangle, entry/exist are both outside
   *   E: mouse line is on the edge of rect, entry/exit are on same edge
   *
   * To trace :
   * - draw to entry point
   * - if on the same edge (E), simply add exitPoint to the wiggle line (ie, draw to it)
   * otherwise
   * - get the two closes corners from where we are (entryPoint at the start)
   * - pick the one that is closest to exitPoint
   * - add that one to the wiggle line and make that point the "current" point
   * - repeat until current point is in the same spot as exitPoint
   *
   */
  const traceObject = (box: DOMRect, current: DOMPoint, entryPoint: DOMPoint, exitPoint: DOMPoint, wiggleLine: Queue<DOMPoint>) => {
    // Helper object with useful coordinates
    const obj = {
      top: box.y,
      left: box.x,
      bottom: box.y + box.height,
      right: box.x + box.width,
      vMid: box.x + box.width / 2,
      hMid: box.y + box.height / 2,
      tl: new DOMPoint(box.x, box.y),
      tr: new DOMPoint(box.x + box.width, box.y),
      bl: new DOMPoint(box.x, box.y + box.height),
      br: new DOMPoint(box.x + box.width, box.y + box.height)
    };

    const lastWigglePoint = wiggleLine.last();

    const startIsInside = isPointInBox(lastWigglePoint, box);
    const endIsInside = isPointInBox(current, box); // inside or on edge
    const endIsOnEdge = isPointOnBox(current, box); // only on edge
    const through = !startIsInside && !endIsInside;
    const inside = startIsInside && endIsInside;
    const entering = !startIsInside && endIsInside;
    const exiting = startIsInside && (!endIsInside || endIsOnEdge);

    // This method will draw _either parts, or all,_ of the trace
    // around the rectangle, depending on user's mouse movement (mouse line)
    const walkAround = () => {
      let nextPoint = entryPoint;
      let c = 0;

      if (arePointsColinear(entryPoint, exitPoint)) {
        // If the two points are on the same edge, we don't
        // need to walk around, just connect them.
        // Make sure they are on edges, not just colinear
        const vAligned = entryPoint.x === exitPoint.x;
        const hAligned = entryPoint.y === exitPoint.y;
        const onLeftOrRight = entryPoint.x === box.left || entryPoint.x === box.right;
        const onTopOrBottom = entryPoint.y === box.top || entryPoint.y === box.bottom;

        if ((vAligned && onLeftOrRight) || (hAligned && onTopOrBottom)) {
          addPoint(exitPoint);
          return;
        }
      }

      while (!pointsEq(nextPoint, exitPoint)) {
        if (!nextPoint) {
          throw new Error("Bug Here");
        }
        const corners = getCorners(nextPoint, obj);
        // Check if we are now on the same line as our exit point
        if (!pointsEq(nextPoint, entryPoint) && arePointsColinear(nextPoint, exitPoint)) {
          addPoint(exitPoint);
          nextPoint = exitPoint;
          continue;
        }
        const closest = getClosestPoint(exitPoint, corners);
        addPoint(closest);
        nextPoint = closest;
        c++;
        if (c > 10) {
          console.log("infinite loop");
          return;
        }
      }
    };

    // This means the mouse line starts and ends outside the rect, cutting straight through
    // See (D) above
    // First, draw up to the entryPoint
    // then walk around
    if (through) {
      DEBUG && console.log("through");
      flattenDiagonals(entryPoint, lastWigglePoint);
      addPoint(entryPoint);
      walkAround();
    }

    // User is moving the mouse inside the rect; there's nothing to do.
    if (inside) {
      DEBUG && console.log("inside");
    }

    // Mouse line starts outside but ends on the rectangle.
    // Draw up to where it crosses (entryPoint)
    if (entering) {
      DEBUG && console.log("entering");
      flattenDiagonals(entryPoint, lastWigglePoint);
      addPoint(entryPoint);
      return false;
    }
    // Mouse line starts inside but ends outside.
    // Draw from previous point (which should be the closest corner to exitPoint)
    // to exitPoint
    if (exiting) {
      // Walk around
      DEBUG && console.log("exiting or edgewalking");
      if (wiggleLine.length > 1) {
        walkAround();
      } else {
        wiggleLine.pop();
        addPoint(exitPoint);
      }
      return true;
    }
    return false;
  };

  // Go brrrrrr
  useRequestAnimationFrame(animate, {});
};
