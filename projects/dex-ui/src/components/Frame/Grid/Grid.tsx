import React, { useRef } from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { useWiggle } from "./useWiggle";

type Grid = {
  bigGrid?: boolean;
  gridSize?: number;
  content: HTMLDivElement;
};

export const Grid: FC<Grid> = ({ gridSize = 24, bigGrid = false, content }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  const width = 3000;
  const bigGridSize = gridSize * 10;

  useWiggle(pathRef, svgRef, content);

  return (
    <Svg ref={svgRef} width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g id="Grid" className="grid">
        <defs>
          {" "}
          <pattern id="smallGrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path
              style={{
                strokeWidth: "1px",
                stroke: "#D6D3D1"
              }}
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              stroke="#eee"
            />
          </pattern>
          <pattern id="bigGrid" width={bigGridSize} height={bigGridSize} patternUnits="userSpaceOnUse">
            <rect width={bigGridSize} height={bigGridSize} fill="url(#smallGrid)" />
            <path
              style={{
                strokeWidth: "3px",
                stroke: "#D6D3D1"
              }}
              d={`M ${bigGridSize} 0 L 0 0 0 ${bigGridSize}`}
              fill="none"
            />
          </pattern>
        </defs>
        <rect x={0} y={0} width={width} height={2000} fill="#F9F8F6" />
        <rect x={0} y={0} width={width} height={2000} fill={`url(#${bigGrid ? "bigGrid" : "smallGrid"})`} />
        <path
          ref={pathRef}
          style={{
            strokeWidth: "2.5px",
            stroke: "rgb(70 185 85 / 70%)"
          }}
          d=""
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <line id="debugline" x1="-5" y1="-5" x2="-5" y2="-5" stroke="red" strokeWidth="3" />
        <ellipse id="debugpoint" cx="-5" cy="-5" rx="3" ry="3" fill="red" />
        <ellipse id="start" cx="-5" cy="-5" rx="5" ry="5" stroke="green" strokeWidth="1" />
        <ellipse id="end" cx="-5" cy="-5" rx="5" ry="5" stroke="red" strokeWidth="1" />
      </g>
    </Svg>
  );
};

const Svg = styled.svg``;
