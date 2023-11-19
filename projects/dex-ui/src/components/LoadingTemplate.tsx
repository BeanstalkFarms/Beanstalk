import React from "react";
import styled from "styled-components";
import { Skeleton } from "./Skeleton";
import { ArrowButton } from "./Swap/ArrowButton";

export function LoadingTemplate() {}

LoadingTemplate.Input = () => (
  <LoadingInputItem>
    {"-"}
    <SkeletonRow>
      <Skeleton width={16} height={16} circle />
      <Skeleton width={48} height={24} />
    </SkeletonRow>
  </LoadingInputItem>
);

LoadingTemplate.Arrow = () => (
  <ArrowContainer>
    <ArrowButton onClick={() => {}} />
  </ArrowContainer>
);

LoadingTemplate.OutputDouble = ({ size }: { size?: number }) => (
  <OutputRow>
    <Background>
      <Skeleton width={90} height={size ? size : 24} />
    </Background>
    <Background>
      <Skeleton width={70} height={size ? size : 24} />
    </Background>
  </OutputRow>
);

LoadingTemplate.Button = () => (
  <Background>
    <Skeleton height={48} />
  </Background>
);

LoadingTemplate.OutputSingle = ({ size, width, mb }: { size?: number; width?: number; mb?: number }) => (
  <Background width={width || 90} mb={mb}>
    <Skeleton width={width || 90} height={size ? size : 24} />
  </Background>
);

LoadingTemplate.Flex = styled.div<{ row?: boolean; gap?: number }>`
  display: flex;
  ${(props) => `
        flex-direction: ${props.row ? "row" : "column"};
        gap: ${props.gap || 0}px;
    `}
`;

const Background = styled.div<{ width?: number; mb?: number }>`
  display: flex;
  background: white;
  ${(props) => `
    width: ${props.width ? `${props.width}px` : "100%"};
    margin-bottom: ${props.mb ? props.mb : 0}px;
  `}
`;

const OutputRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const LoadingInputItem = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  box-sizing: border-box;
  background: #fff;
  border: 0.5px solid #d1d5db;
  padding: 23.5px 8px;
  outline: 0.5px solid black;
  //   outline-offset: -1px;
`;

const SkeletonRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const ArrowContainer = styled.div`
  // border: 1px dashed orange;
  display: flex;
  flex-direction: row;
  justify-content: center;
`;
