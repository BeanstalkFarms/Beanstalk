import React from "react";
import styled from "styled-components";
import { FC } from "src/types";
import { Grid } from "src/components/Frame/assets/Grid";
export const Window: FC<{}> = ({ children }) => {
  return (
    <ViewPort id="viewport">
      <GridContainer>
        <Grid />
      </GridContainer>
      <Content>{children}</Content>
    </ViewPort>
  );
};

const ViewPort = styled.main`
  position: relative;
  width: 100vw;
  height: 100%;
  overflow: hidden;
  // overflow-y: auto;
  cursor: crosshair;
  box-sizing: border-box;
`;

const Content = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
`;
const GridContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100%;
`;
