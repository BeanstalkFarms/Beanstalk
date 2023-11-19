import React from "react";
import { size } from "src/breakpoints";
import styled from "styled-components";
import { LoadingTemplate } from "../LoadingTemplate";

export const SwapLoading: React.FC<{}> = () => {
  return (
    <Container>
      <LoadingTemplate.Input />
      <LoadingTemplate.Arrow />
      <LoadingTemplate.Input />
      <LoadingTemplate.OutputDouble />
      <LoadingTemplate.Button />
    </Container>
  );
};

const Container = styled.div`
  width: 384px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  @media (max-width: ${size.mobile}) {
    width: 100%;
    gap: 16px;
  }
`;

export default SwapLoading;
