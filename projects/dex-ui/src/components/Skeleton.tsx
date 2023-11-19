import React from "react";

import styled, { css, keyframes } from "styled-components";

export type SkeletonProps = {
  height: number;
  width?: number;
  // if true, rounded will be ignored
  circle?: boolean;
  // defaults to false
  rounded?: boolean;
  // defaults to pulse
  shimmer?: boolean;
};

export const Skeleton: React.FC<SkeletonProps> = (props) => {
  if (props.shimmer) {
    return <SkeletonShimmer {...props} />;
  }

  return <SkeletonPulse {...props} />;
};

const pulse = () => keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
`;

const shimmer = () => keyframes`
  0% {
    background-position: -800px 0;
  }
  100% {
    background-position: 800px 0;
  }
`;

const SkeletonBase = css<SkeletonProps>`
  display: inline-block;
  ${(props) => `
    height: ${props.height ? `${props.height}px` : "100%"};
    width: ${props.width ? `${props.width}px` : "100%"};
    border-radius: ${props.circle ? "50%" : props.rounded === true ? `4px` : "0px"};
  `}
`;

const SkeletonPulse = styled.div<SkeletonProps>`
  ${SkeletonBase}
  background: linear-gradient(to right, #e5e7eb 8%, #F3F4F6 18%, #e5e7eb 33%);
  background-size: 1200px 100%;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const SkeletonShimmer = styled.div<SkeletonProps>`
  ${SkeletonBase}
  background: linear-gradient(65deg, #f3f4f6 8%, #e5e7eb 18%, #f3f4f6 33%);
  background-size: 1200px 100%;
  animation: ${shimmer} 2s linear infinite;
`;
