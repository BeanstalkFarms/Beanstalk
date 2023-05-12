import { RefObject, useEffect, useRef } from "react";
import segment_js from "src/types/segment-js";
// @ts-ignore
import Segment from "segment-js";
import { roundPathCorners } from "./Rounding";
import throttle from "lodash/throttle";
import { Queue } from "./Queue";
import useRequestAnimationFrame from "./useAnimationFrame";

export const useWiggle = (pathRef: RefObject<SVGPathElement>, svgRef: RefObject<SVGSVGElement>) => {
  // A FILO Queue to store the last N mouse positions
  const mouseLocationsRef = useRef<Queue>(new Queue(10));

  // a library that helps us "draw" an svg path.
  // Once we create the path ourselves, this lib does the
  // "shrink" (reverse draw) effect on that path
  const segmentRef = useRef<segment_js>();

  // Start listening for mouse movements
  useEffect(() => {
    document.addEventListener("mousemove", mouseMove);
    return () => {
      document.removeEventListener("mousemove", mouseMove);
    };
  });

  const mouseMove = throttle((e: MouseEvent) => {
    const svg = svgRef.current;
    const path = pathRef.current;
    const mouseLocations = mouseLocationsRef.current;
    const prev = mouseLocations.last();

    if (!svg || !path) return;

    // Create a Point object
    const pt = svg.createSVGPoint();

    // assign the mouse position to it
    pt.x = e.clientX;
    pt.y = e.clientY;

    // convert the mouse coordinate to SVG coordinate
    const pos = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    // snap to grid
    pos.x = snap(pos.x);
    pos.y = snap(pos.y);

    // make sure the new point is not diagonal
    flattenDiagonals(pos, prev);

    // add it to the Queue
    mouseLocations.push(pos);

    // How this Segment-js lib works is confusion and not
    // intuitive. Not gonna explain here in detail much but..

    // If we have an existing segment animating, stop it.
    // We're here because the mouse moved, and while the mouse is
    // moving we keep adding points to the Queue, ie, re-drawing the path
    // and killing the Segment animation.
    // If the mouse stops moving, the Segment animation has a chance to play out
    if (segmentRef.current) {
      segmentRef.current.stop();
    }
    // Start a new animation
    segmentRef.current = new Segment(path);
    // The confusing part, the "END STATE" of the animation is that we want
    // the dash-strokes to `begin` at 100% and `end` at 100%. The lib allows you to
    // animate the dash stroke to any begin/end. DON'T confuse this with (0, 100)
    // as that does not mean begin at 0 and end at 100.. it means the END STATE is a
    // dash line that starts at 0% and ends at 100%, ie, the whole path is visible.
    segmentRef.current!.draw("100%", "100%", 0.1, {
      // Once the segment animation is over, delete all points (ie, delete the path)
      callback: () => {
        mouseLocations.items = [];
      }
    });
  }, 20); // <-- THIS IS IMPORTANT: It affects the "resolution" of the path

  // Every 60FPS, take the mouse position data from the Queue
  // and create an SVG path from it, manually.
  const animate = (_: number) => {
    const path = pathRef.current;
    const mouseLocations = mouseLocationsRef.current;
    if (!path || !mouseLocations) return;

    let pathData = "";
    const points = mouseLocations.items as DOMPoint[];
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

    // Give our path rounded corners
    const roundedPathData = roundPathCorners(pathData, 4.5, false);
    path.setAttribute("d", roundedPathData);
  };

  // Go brrrrrr 60fps
  useRequestAnimationFrame(animate, {});
};

/**
 * Moves a point to the nearest spot on the grid
 */
const snap = (pos: number) => {
  const grid = 24;
  const quotient = Math.floor(pos / grid);
  const remainder = pos % grid;
  const final = remainder >= grid / 2 ? quotient + 1 : quotient;

  return final * grid;
};

/**
 * Mutates the `pos` parameter!
 * If there's points that would create a diagonal line, top-left to bottom right of a grid square,
 * this method flattens that line so we only get straight edges
 */
const flattenDiagonals = (pos: DOMPoint, prev: DOMPoint) => {
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
