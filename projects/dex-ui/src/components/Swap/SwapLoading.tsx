import React from "react";
import { size } from "src/breakpoints";
import styled from "styled-components";
import { Skeleton } from "../Skeleton";
import { ArrowButton } from "./ArrowButton";

export const SwapLoading: React.FC<{}> = () => {
  return (
    <Container>
      <LoadingInput>
        {"-"}
        <SkeletonRow>
          <Skeleton width={16} height={16} circle />
          <Skeleton width={48} height={24} rounded />
        </SkeletonRow>
      </LoadingInput>
      <ArrowContainer>
        <ArrowButton onClick={() => {}} />
      </ArrowContainer>
      <LoadingInput>
        {"-"}
        <SkeletonRow>
          <Skeleton width={16} height={16} circle />
          <Skeleton width={48} height={24} rounded />
        </SkeletonRow>
      </LoadingInput>
      <OutputRow>
        <Background>
          <Skeleton width={90} height={24} />
        </Background>
        <Background>
          <Skeleton width={70} height={24} />
        </Background>
      </OutputRow>
      <Background>
        <Skeleton height={48} rounded={false} />
      </Background>
    </Container>
  );
};

const Background = styled.div`
  display: flex;
  background: white;
`;

const OutputRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const LoadingInput = styled.div`
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

const ArrowContainer = styled.div`
  // border: 1px dashed orange;
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const SwapButtonContainer = styled.div`
  // border: 1px dashed pink;
  display: flex;
  flex-direction: column;
  justify-content: center;
  @media (max-width: ${size.mobile}) {
    position: fixed;
    width: calc(100% - 24px);
    margin-bottom: 0;
    bottom: 12px;
  }
`;

export default SwapLoading;
