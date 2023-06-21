import React from "react";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import styled from "styled-components";

export const Build = () => {
  return (
    <Page>
      <Title title="Build" />
      Coming soon...
    </Page>
  );
};

const Box = styled.div`
  outline: 0.5px solid black;
  outline-offset: -0.5px;
  background-color: #ffffffff ;
  height: 96px;
  width: 384px;
  margin-left: 96px;
  box-sizing: borderbox;
`;
