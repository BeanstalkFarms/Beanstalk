import React from "react";
import styled from "styled-components";
import { FC } from "src/types";

export const Window: FC<{}> = ({ children }) => {
  return <ViewPort id="viewport">{children}</ViewPort>;
};

const ViewPort = styled.main`
  // outline: 1px solid red;
  position: relative;
  width: 100vw;
  height: 100%;
  overflow: hidden;
  overflow-y: auto;
  cursor: crosshair;
  box-sizing: border-box;
`;

const Canvas = styled.div`
  box-sizing: border-box;
  outline: 3px solid blue;
  outline-offset: -3px;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0px;
`;
