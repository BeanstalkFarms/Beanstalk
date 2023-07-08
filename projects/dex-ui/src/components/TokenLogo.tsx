import { Token } from "@beanstalk/sdk";
import React from "react";
import { images } from "src/assets/images/tokens";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  size?: number;
  mobileSize?: number;
  token?: Token;
  isLP?: boolean;
};

export const TokenLogo: FC<Props> = ({ size = 32, mobileSize = 32, token, isLP = false }) => {
  const image = images[isLP ? "LP" : token?.symbol ?? "DEFAULT"] ?? images.DEFAULT;

  return (
    <Container width={size} height={size} mobileWidth={mobileSize} mobileHeight={mobileSize} >
      <img src={image} alt={`${token?.symbol} Logo`} />
    </Container>
  );
};

type ContainerProps = {
  width: number,
  height: number,
  mobileWidth: number,
  mobileHeight: number,
}

const Container = styled.div<ContainerProps>`
  display: flex;
  justify-content: center;
  align-items: center;

  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  img {
    width: ${(props) => props.width}px;
    height: ${(props) => props.height}px;
  }

  @media (max-width: 475px) {
    width: ${(props) => props.mobileWidth}px;
    height: ${(props) => props.mobileHeight}px;
    img {
      width: ${(props) => props.mobileWidth}px;
      height: ${(props) => props.mobileHeight}px;
    }
  }
`;
