import { Token } from "@beanstalk/sdk";
import React from "react";
import { size } from "src/breakpoints";
import { FC } from "src/types";
import { useTokenImage } from "src/tokens/useTokenMetadata";
import styled from "styled-components";

type Props = {
  size: number;
  mobileSize?: number;
  token?: Token;
  isLP?: boolean;
};

export const TokenLogo: FC<Props> = ({ size, mobileSize, token, isLP: _isLP = false }) => {
  const img = useTokenImage(token);

  return (
    <Container
      width={size}
      height={size}
      mobileWidth={mobileSize || size}
      mobileHeight={mobileSize || size}
    >
      <img src={img} alt={`${token?.symbol} Logo`} />
    </Container>
  );
};

type ContainerProps = {
  width: number;
  height: number;
  mobileWidth: number;
  mobileHeight: number;
};

const Container = styled.div<ContainerProps>`
  display: flex;
  justify-content: center;
  align-items: center;

  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  img {
    width: ${(props) => props.width}px;
    height: ${(props) => props.height}px;
    border-radius: 50%;
  }

  @media (max-width: ${size.mobile}) {
    width: ${(props) => props.mobileWidth}px;
    height: ${(props) => props.mobileHeight}px;
    img {
      width: ${(props) => props.mobileWidth}px;
      height: ${(props) => props.mobileHeight}px;
      border-radius: 50%;
    }
  }
`;
