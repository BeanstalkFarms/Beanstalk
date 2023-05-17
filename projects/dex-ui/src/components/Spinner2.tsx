import React from "react";
import { FC } from "src/types";
import styled, { keyframes } from "styled-components";

type Props = {
  size: number;
};

export const Spinner2: FC<Props> = ({ size }) => {
  return (
    <SpinnerContainer size={size}>
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <Rect x="2" y="2" width="68" height="68" fill="none" stroke="red" strokeWidth={4} rx="15" />
      </svg>
    </SpinnerContainer>
  );
};

const spinAnimation = keyframes`
0% {
    stroke-dashoffset: 0px;
}
100% {
      stroke-dashoffset: -290px;
}
`;

const Rect = styled.rect`
  stroke-dasharray: 145px;
  stroke-dashoffset: 0px;
  stroke: rgb(70 185 85 / 70%);
  animation: ${spinAnimation} 1.2s linear infinite;
`;

const SpinnerContainer = styled.div<Props>`
  display: flex;
  align-self: center;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
`;
