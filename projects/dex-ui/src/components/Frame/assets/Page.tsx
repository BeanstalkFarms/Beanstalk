import React from "react";
import styled from "styled-components";

import { FC } from "src/types";

export const Page: FC<{}> = ({ children }) => {
  return <PageContainer id="page">{children}</PageContainer>;
};

const PageContainer = styled.div`
  // border: 3px solid red;
  display: flex;
  padding: 48px;
`;
