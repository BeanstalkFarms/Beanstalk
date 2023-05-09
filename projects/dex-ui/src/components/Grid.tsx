import React from "react";
import { FC } from "src/types";

type Grid = {};

export const Grid: FC<Grid> = () => {
  const SIZE = 3000;
  const SMALL_SPACING = 24;
  const BIG_SPACING = 240;

  const gridPattern = (
    <React.Fragment>
      <pattern id="smallGrid" width={SMALL_SPACING} height={SMALL_SPACING} patternUnits="userSpaceOnUse">
        <path
          style={{
            strokeWidth: "1px",
            stroke: "#0000000d"
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
            stroke: "#0000000d"
          }}
          d={`M ${BIG_SPACING} 0 L 0 0 0 ${BIG_SPACING}`}
          fill="none"
        />
      </pattern>
    </React.Fragment>
  );

  return (
    <svg width="100%" height="100%"  fill="none" xmlns="http://www.w3.org/2000/svg">
      <g id="Grid" className="grid">
        <defs>{gridPattern}</defs>
        <rect x={-1 * SIZE} y={-1 * SIZE} width={SIZE * 2} height={SIZE * 2} fill={`url(#bigGrid)`} />
      </g>
    </svg>
  );
};
