import React from "react";
import styled from "styled-components";

import { FC } from "src/types";

export const Page: FC<{}> = ({ children }) => {
  return <PageContainer id="page">{children}</PageContainer>;
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 48px;
`;
