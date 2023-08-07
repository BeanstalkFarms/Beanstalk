import React from "react";
import styled from "styled-components";

import { FC } from "src/types";
import { size } from "src/breakpoints";

export const Page: FC<{}> = ({ children }) => {
  return <PageContainer id="page">{children}</PageContainer>;
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  @media (min-width: ${size.mobile}) {
    gap: 24px;
    padding: 48px;
  }
`;
