import { Token } from "@beanstalk/sdk";
import React from "react";
import { images } from "src/assets/images/tokens";
import { size } from "src/breakpoints";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  size: number;
  mobileSize?: number;
  token?: Token;
  isLP?: boolean;
};

export const TokenLogo: FC<Props> = ({ size, mobileSize, token, isLP = false }) => {
  const image = images[isLP ? "LP" : token?.symbol ?? "DEFAULT"] ?? images.DEFAULT;

  return (
    <Container width={size} height={size} mobileWidth={mobileSize || size} mobileHeight={mobileSize || size}>
      <img src={image} alt={`${token?.symbol} Logo`} />
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
  }

  @media (max-width: ${size.mobile}) {
    width: ${(props) => props.mobileWidth}px;
    height: ${(props) => props.mobileHeight}px;
    img {
      width: ${(props) => props.mobileWidth}px;
      height: ${(props) => props.mobileHeight}px;
    }
  }
`;
