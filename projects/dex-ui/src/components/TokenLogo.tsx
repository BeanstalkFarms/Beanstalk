import { Token } from "@beanstalk/sdk";
import React from "react";
import { images } from "src/assets/images/tokens";
import { size } from "src/breakpoints";
import { FC } from "src/types";
import { useTokenMetadata } from "src/tokens/useTokenMetadata";
import styled from "styled-components";

type Props = {
  size: number;
  mobileSize?: number;
  token?: Token;
  isLP?: boolean;
};

export const TokenLogo: FC<Props> = ({ size, mobileSize, token, isLP = false }) => {
  const metadata = useTokenMetadata(token?.address);
  const img = getImg({ metadata, token, isLP });

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

const getImg = ({ metadata, token, isLP }: { metadata: ReturnType<typeof useTokenMetadata>, token?: Token, isLP?: boolean  }) => {
  if (token?.logo && !token?.logo?.includes("DEFAULT.svg")) {
    return token.logo;
  };
  if (metadata?.logo && !metadata?.logo?.includes("DEFAULT.svg")) {
    return metadata.logo;
  };

  return isLP ? images.LP : images.DEFAULT;
}

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
