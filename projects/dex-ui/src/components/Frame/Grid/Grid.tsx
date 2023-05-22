import React, { useRef } from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { useWiggle } from "./useWiggle";

type Grid = {
  type?: "line" | "dot";
  bigGrid?: boolean;
  gridSize?: number;
  color?: string;
  content: HTMLDivElement;
};

export const Grid: FC<Grid> = ({ gridSize = 24, bigGrid = false, content, color = "#E7E4E6", type = "dot" }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  const width = 3000;
  const bigWidth = gridSize * 10;
  const radius = 2;
  const bigRadius = 4;

  useWiggle(pathRef, svgRef, content);

  return (
    <Svg ref={svgRef} width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g id="Grid" className="grid">
        <defs>
          {" "}
          <pattern id="smallGrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            {type === "line" ? (
              <path
                style={{
                  strokeWidth: "1px",
                  stroke: "#D6D3D1"
                }}
                d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                stroke="#eee"
              />
            ) : (
              <>
                <ellipse cx={0} cy={0} rx={radius} ry={radius} fill={color} stroke="none" />
                <ellipse cx={0} cy={gridSize} rx={radius} ry={radius} fill={color} stroke="none" />
                <ellipse cx={gridSize} cy={gridSize} rx={radius} ry={radius} fill={color} stroke="none" />
                <ellipse cx={gridSize} cy={0} rx={radius} ry={radius} fill={color} stroke="none" />
              </>
            )}
          </pattern>
          <pattern id="bigGrid" width={bigWidth} height={bigWidth} patternUnits="userSpaceOnUse">
            <rect width={bigWidth} height={bigWidth} fill="url(#smallGrid)" />
            {type === "line" ? (
              <path
                style={{
                  strokeWidth: "3px",
                  stroke: "#D6D3D1"
                }}
                d={`M ${bigWidth} 0 L 0 0 0 ${bigWidth}`}
                fill="none"
              />
            ) : (
              <>
                <ellipse cx={0} cy={0} rx={bigRadius} ry={bigRadius} fill={color} stroke="none" />
                <ellipse cx={0} cy={bigWidth} rx={bigRadius} ry={bigRadius} fill={color} stroke="none" />
                <ellipse cx={bigWidth} cy={bigWidth} rx={bigRadius} ry={bigRadius} fill={color} stroke="none" />
                <ellipse cx={bigWidth} cy={0} rx={bigRadius} ry={bigRadius} fill={color} stroke="none" />
              </>
            )}
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
