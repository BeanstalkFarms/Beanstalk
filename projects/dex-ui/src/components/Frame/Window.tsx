import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Grid } from "./assets/Grid";
import { FC } from "src/types";
import { useLocation } from "react-router-dom";

export const Window: FC<{}> = ({ children }) => {
  return (
    <ViewPort id="viewport">
      <Canvas id="canvas">
        <Grid />
        <Content id="content">{children}</Content>
      </Canvas>
    </ViewPort>
  );
};

const ViewPort = styled.main`
  // outline: 1px solid red;
  box-sizing: border-box;
  width: 100vw;
  height: 100%;
  position: relative;
  overflow: hidden;
  overflow: auto;
  cursor: crosshair;
`;

const Canvas = styled.div`
  box-sizing: border-box;
  // outline: 3px solid blue;
  outline-offset: -3px;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0px;

  transition-property: left;
  transition-duration: 0.7s;
  transition-timing-function: cubic-bezier(0.15, 1.3, 0.84, 0.98);
`;

const Content = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  padding: 48px;
`;
