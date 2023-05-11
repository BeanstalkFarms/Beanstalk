import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Grid } from "./assets/Grid";
import { FC } from "src/types";
import { useLocation } from "react-router-dom";

type Props = {
  routes: Record<string, JSX.Element>;
};

export const Window: FC<Props> = ({ routes }) => {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [elements, setElements] = useState<JSX.Element[]>([]);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const location = useLocation();

  const canvasRef = useCallback((node) => {
    if (node !== null) {
      setViewportWidth(node.clientWidth ?? 0);
    }
  }, []);

  useEffect(() => {
    let i = 0;
    const positions: Record<string, number> = {};
    const elements: JSX.Element[] = [];
    // console.log("viewportWidth", viewportWidth);
    let prevPosition = 0;
    for (const [key, value] of Object.entries(routes)) {
      let x = prevPosition + viewportWidth + 200;
      x = Math.floor(x / 24) * 24;
      positions[key] = x;

      const el = (
        <Position x={x} key={i}>
          {value}
        </Position>
      );
      elements.push(el);
      i++;
      prevPosition = x;
    }
    setElements(elements);
    setPositions(positions);
  }, [viewportWidth, routes]);

  const positionToView = positions[location.pathname] * -1 + 48;
  const widths = Object.values(positions);
  const maxWidth = widths[widths.length - 1] + viewportWidth;

  console.log("positions", positions);
  return (
    <ViewPort id="viewport" ref={canvasRef}>
      <Canvas id="canvas" panTo={positionToView} width={maxWidth}>
        <Grid width={maxWidth} />
        <Content id="content">{elements}</Content>
      </Canvas>
    </ViewPort>
  );
};

type PositionProps = {
  x: number;
};

const Position = styled.div<PositionProps>`
  position: absolute;
  top: 48px;
  left: ${(props) => props.x}px;
`;

const ViewPort = styled.main`
  // outline: 1px solid red;
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow-x: hidden;
  cursor: crosshair;
`;

type CanvasProps = {
  panTo: number;
  width: number;
};
const Canvas = styled.div<CanvasProps>`
  box-sizing: border-box;
  // outline: 3px solid blue;
  outline-offset: -3px;
  width: ${({ width }) => `${width}px` ?? "100%"};
  height: 100%;
  position: absolute;
  top: 0;
  left: ${({ panTo }) => panTo ?? 0}px;

  transition-property: left;
  transition-duration: .7s;
  transition-timing-function: cubic-bezier(.15,1.3,.84,.98);
`;

const Content = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  padding: 48px;
`;
