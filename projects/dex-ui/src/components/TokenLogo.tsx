import { Token } from "@beanstalk/sdk";
import React from "react";
import { images } from "src/assets/images/tokens";
import { size } from "src/breakpoints";
import { useERC20TokenWithAddress } from "src/tokens/useERC20Token";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  size: number;
  mobileSize?: number;
  token?: Token;
  isLP?: boolean;
};

export const TokenLogo: FC<Props> = ({ size, mobileSize, token: _token, isLP = false }) => {
  const { data: token } = useERC20TokenWithAddress(_token?.address);
  const symbol = token?.symbol ? token?.symbol : isLP ? "LP" : "DEFAULT";

  let image = token?.logo ?? images[symbol];

  if (isLP && token?.logo?.includes("DEFAULT")) {
      image = images.LP;
  }

  if (!image) {
    image = isLP ? images.LP : images.DEFAULT;
  }

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
