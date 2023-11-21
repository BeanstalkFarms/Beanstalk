import { FC } from "src/types";
import React from "react";
import styled from "styled-components";

type Props = {
  children: any;
  content: any;
  offsetX: number;
  offsetY: number;
  arrowSize: number;
  arrowOffset: number;
  side: string;
  width?: number;
  bgColor?: "black" | "white";
};

export const Tooltip: FC<Props> = ({ children, content, offsetX, offsetY, arrowSize, arrowOffset, side, width, bgColor = "black" }) => {
  return (
    <TooltipContainer>
      {children}
      <TooltipBox
        offsetX={offsetX}
        offsetY={offsetY}
        arrowSize={arrowSize}
        arrowOffset={arrowOffset}
        width={width}
        side={side}
        bgColor={bgColor}
      >
        {content}
      </TooltipBox>
    </TooltipContainer>
  );
};

export type TooltipProps = {
  offsetX: number;
  offsetY: number;
  arrowSize: number;
  arrowOffset: number;
  side: string;
  width?: number;
  bgColor?: "black" | "white";
};

const TooltipContainer = styled.div`
  position: relative;
`;

const TooltipBox = styled.div<TooltipProps>`
  padding: 8px;
  border-radius: 2px;
  background: ${(props) => (props.bgColor === "white" ? "#FFF" : "#000")};
  color: ${(props) => (props.bgColor === "white" ? "#000" : "#FFF")};
  position: absolute;
  transform: translateX(${(props) => props.offsetX}%);
  width: ${(props) => (props.width ? props.width : 200)}px;
  border: ${(props) => (props.bgColor === "white" ? "1px solid #000" : "none")};
  line-height: 18px;
  font-size: 14px;
  visibility: hidden;
  z-index: 100;
  ${(props) =>
    props.side === "top"
      ? `top: ${props.offsetY * -1}%;
         left: ${props.offsetX}%;`
      : props.side === "left"
      ? `left: auto;
        right: calc(100% + ${props.offsetX}%);
        top: ${props.offsetY}%;`
      : props.side === "right"
      ? `left: calc(100% + ${props.offsetX}%);
        top: ${props.offsetY}%;`
      : //props.side === 'bottom
        `bottom: ${props.offsetY * -1}%;`}
  ${TooltipContainer}:hover & {
    visibility: visible;
  }
  &:before {
    content: "";
    width: 0;
    height: 0;
    position: absolute;
    border: ${(props) => props.arrowSize}px solid #000;
    transform: rotate(135deg);
    z-index: 99;
    ${(props) =>
      props.side === "top"
        ? `top: calc(100% - ${props.arrowSize}px);
             left: ${props.arrowOffset}%;`
        : props.side === "left"
        ? `left: calc(100% - ${props.arrowSize}px);
             top: ${props.arrowOffset}%;`
        : props.side === "right"
        ? `right: calc(100% - ${props.arrowSize}px);;
             top: ${props.arrowOffset}%;`
        : //props.side === 'bottom
          `bottom: calc(100% - ${props.arrowSize}px);`}
  }
`;
