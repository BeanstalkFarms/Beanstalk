import React from "react";

import styled, { css, keyframes } from "styled-components";

import { theme } from "src/utils/ui/theme";

import { CheckIcon, XIcon } from "./Icons";

interface ProgressCircleProps {
  size: number; // Size of the circle
  progress: number; // Current progress (0 to 100)
  strokeWidth: number; // Width of the stroke
  trackColor: string; // Color of the background circle
  strokeColor: string; // Color of the progress stroke
}

// Keyframes for the spinning animation
const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const createOscillatingAnimation = (circumference: number, progress: number) => keyframes`
  50% {
    stroke-dashoffset: ${circumference - (progress / 100) * circumference};
  }
  0%, 100% {
    stroke-dashoffset: ${circumference};
  }
`;

// Styled circle for the progress
const Circle = styled.circle<{
  circumference: number;
  progress: number;
  animate: boolean;
}>`
  fill: none;
  stroke-width: ${(props) => props.strokeWidth};
  stroke-dasharray: ${(props) => props.circumference};
  animation: ${(props) =>
    props.animate &&
    css`
      ${createOscillatingAnimation(props.circumference, props.progress)} 3500ms ease-in-out infinite
    `};
`;

// Styled SVG container with spin animation
const ProgressSVG = styled.svg<{ progress: number; circumference: number }>`
  transform: rotate(-90deg);
  animation: ${spin} 650ms linear infinite;
`;

const ProgressCircle = ({
  size,
  progress,
  strokeWidth,
  trackColor,
  strokeColor,
  animate = false,
  status
}: ProgressCircleProps & {
  animate?: boolean;
  status?: "success" | "error";
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  if (status) {
    return (
      <StatusContainer size={size}>
        <svg viewBox={`0 0 ${size} ${size}`}>
          <circle
            cy={size / 2}
            cx={size / 2}
            r={radius}
            fill={status === "success" ? theme.colors.primary : theme.colors.errorRed}
          />
        </svg>
        <AbsoluteCenter>
          {status === "success" && <CheckIcon color={theme.colors.white} width={30} height={30} />}
          {status === "error" && <XIcon color={theme.colors.white} width={12.5} height={12.5} />}
        </AbsoluteCenter>
      </StatusContainer>
    );
  }

  return (
    <ProgressSVG
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      circumference={circumference}
      progress={progress}
    >
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        opacity="0.3"
        circumference={circumference}
        progress={0}
        animate={animate}
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        circumference={circumference}
        progress={progress}
        animate={animate}
      />
    </ProgressSVG>
  );
};

const StatusContainer = styled.div<{ size: number }>`
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;
  position: relative;
`;

const AbsoluteCenter = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
`;

export { ProgressCircle };
