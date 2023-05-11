import React, { useEffect, useMemo, useRef, useState } from "react";
import { FC } from "src/types";
import useRequestAnimationFrame from "./useAnimationFrame";
import { Queue } from "./Queue";
import throttle from "lodash/throttle";
import { roundPathCorners } from "./Rounding";
// @ts-ignore
import Segment from "segment-js";

type Grid = {
  width: number;
  bigGrid?: boolean;
};

export const Grid: FC<Grid> = ({ width = 500, bigGrid = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const item = useRef<SVGEllipseElement>(null);
  const mouseLocations = useRef<Queue>(new Queue(10));
  const segment = useRef();

  const SMALL_SPACING = 24;
  const BIG_SPACING = SMALL_SPACING * 10;

  const gridPattern = (
    <React.Fragment>
      <pattern id="smallGrid" width={SMALL_SPACING} height={SMALL_SPACING} patternUnits="userSpaceOnUse">
        <path
          style={{
            strokeWidth: "1px",
            stroke: "#D6D3D1"
          }}
          d={`M ${SMALL_SPACING} 0 L 0 0 0 ${SMALL_SPACING}`}
          fill="none"
          stroke="#eee"
        />
      </pattern>
      <pattern id="bigGrid" width={BIG_SPACING} height={BIG_SPACING} patternUnits="userSpaceOnUse">
        <rect width={BIG_SPACING} height={BIG_SPACING} fill="url(#smallGrid)" />
        <path
          style={{
            strokeWidth: "3px",
            stroke: "#D6D3D1"
          }}
          d={`M ${BIG_SPACING} 0 L 0 0 0 ${BIG_SPACING}`}
          fill="none"
        />
      </pattern>
    </React.Fragment>
  );

  console.log("Grid Width: ", width);

  useEffect(() => {
    document.addEventListener("mousemove", mouseMove);
    return () => {
      document.removeEventListener("mousemove", mouseMove);
    };
  });

  const mouseMove = throttle((e: MouseEvent) => {
    const svg = svgRef.current;
    const prev = mouseLocations.current.last();

    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    loc.x = snap(loc.x);
    loc.y = snap(loc.y);

    noDiagonal(loc, prev);
    mouseLocations.current.push(loc);
    // @ts-ignore
    if (segment.current) {
      segment.current.stop();
    }
    segment.current = new Segment(item.current);
    // segment.current.draw('100%', '100%', .25);
    segment.current.draw("100%", "100%", 0.1, {
      // Once the segment animation is over, delete all points (ie, delete the path)
      callback: () => {
        console.log("done");
        mouseLocations.current.items = [];
      }
    });
  }, 20); // <-- THIS IS IMPORTANT: It affects the "resolution" of the path

  const animate = (_: number) => {
    const path = item.current;
    if (!path) return;

    let pathData = "";
    const points = mouseLocations.current.items as DOMPoint[];
    for (const [i, point] of points.entries()) {
      const { x, y } = point;
      if (i == 0) {
        pathData = `M ${x} ${y}`;
      } else {
        pathData = `${pathData} L ${x} ${y}`;
      }
    }
    const roundedPathData = roundPathCorners(pathData, 3, false);
    path.setAttribute("d", roundedPathData);
  };

  useRequestAnimationFrame(animate, {});

  return (
    <svg ref={svgRef} width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g id="Grid" className="grid">
        <defs>{gridPattern}</defs>
        <rect x={0} y={0} width={width} height={2000} fill={`url(#${bigGrid ? "bigGrid" : "smallGrid"})`} />
        <path
          ref={item}
          style={{
            strokeWidth: "1px",
            stroke: "rgb(70 185 85 / 60%)"
          }}
          d=""
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

const snap = (pos: number) => {
  const grid = 24;
  const quotient = Math.floor(pos / grid);
  const remainder = pos % grid;
  const final = remainder >= grid / 2 ? quotient + 1 : quotient;

  return final * grid;
};

/**
 * Mutates the `pos` parameter!
 */
const noDiagonal = (pos: DOMPoint, prev: DOMPoint) => {
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
