import React from "react";
import { FC } from "src/types";
import styled, { keyframes } from "styled-components";

type Props = {
  size: number;
};

export const Spinner: FC<Props> = ({ size }) => {
  return (
    <SpinnerContainer size={size}>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </SpinnerContainer>
  );
};

const spinAnimation = keyframes`
0% {
  transform: rotate(0deg);
}
100% {
  transform: rotate(360deg);
}
`;

const SpinnerContainer = styled.div<Props>`
  display: inline-block;
  position: relative;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  // padding-left: 5px;

  div {
    box-sizing: border-box;
    display: block;
    position: absolute;
    width: ${({ size }) => size}px;
    height: ${({ size }) => size}px;
    border: ${({ size }) => size * 0.1}px solid #696f8a;
    border-radius: 50%;
    animation: ${spinAnimation} 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    border-color: #696f8a transparent transparent transparent;
  }
  div:nth-child(1) {
    animation-delay: -0.45s;
  }
  div:nth-child(2) {
    animation-delay: -0.3s;
  }
  div:nth-child(3) {
    animation-delay: -0.15s;
  }
`;
