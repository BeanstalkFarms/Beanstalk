import React from 'react';

export type SVGIconProps = {
  height?: number;
  width?: number;
  color?: string;
};

export const LongArrowRight = ({
  height,
  width,
  color = 'black',
}: SVGIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width || 17}
    height={height || 8}
    viewBox="0 0 17 8"
    fill="none"
  >
    <path
      d="M16.8536 4.35355C17.0488 4.15829 17.0488 3.84171 16.8536 3.64645L13.6716 0.464466C13.4763 0.269204 13.1597 0.269204 12.9645 0.464466C12.7692 0.659728 12.7692 0.976311 12.9645 1.17157L15.7929 4L12.9645 6.82843C12.7692 7.02369 12.7692 7.34027 12.9645 7.53553C13.1597 7.7308 13.4763 7.7308 13.6716 7.53553L16.8536 4.35355ZM0.5 4.5H16.5V3.5H0.5V4.5Z"
      fill={color}
    />
  </svg>
);
