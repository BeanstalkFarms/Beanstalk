import React, { RefCallback, useCallback, useRef, useState } from "react";
import styled from "styled-components";
import { FC } from "src/types";
import { Grid } from "src/components/Frame/Grid/Grid";
export const Window: FC<{}> = ({ children }) => {
  const [contentElement, setContentElement] = useState<HTMLDivElement>();

  const ref: RefCallback<HTMLDivElement> = useCallback((node: HTMLDivElement | null) => {
    if (node) setContentElement(node);
  }, []);

  return (
    <ViewPort id="viewport">
      <GridContainer>{contentElement && <Grid content={contentElement} />}</GridContainer>
      <Content ref={ref}>{children}</Content>
    </ViewPort>
  );
};

const ViewPort = styled.main`
  position: relative;
  width: 100vw;
  height: 100%;
  overflow: hidden;
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
