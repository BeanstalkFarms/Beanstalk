import React from "react";
import styled from "styled-components";
import { Grid } from "src/components/Frame/assets/Grid";

import { FC } from "src/types";

export const Page: FC<{}> = ({ children }) => {
  return (
    <PageContainer id="page">
      <Content id="content">{children}</Content>
      <GridContainer>
        <Grid />
      </GridContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  border: 3px solid red;
  width: 100vw;
  display: flex;
  // flex-direction: row;
  // height: -moz-available; /* WebKit-based browsers will ignore this. */
  // height: -webkit-fill-available; /* Mozilla-based browsers will ignore this. */
  // height: fill-available;
  // flex: 1
`;

const Content = styled.div`
  // position: absolute;
  // position: relative;
  display: flex;
  top: 0;
  left: 0;
  padding: 48px;
  // border: 2px solid green;
  z-index: 2;
`;

const GridContainer = styled.div`
  border: 1px solid blue;
  right: 0;
  // height: 100%;
  // display: flex;
`;
