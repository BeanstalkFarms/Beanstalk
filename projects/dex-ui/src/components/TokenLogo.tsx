import { Token } from "@beanstalk/sdk";
import React from "react";
import { images } from "src/assets/images/tokens";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  size?: number;
  token?: Token;
  isLP?: boolean;
};

export const TokenLogo: FC<Props> = ({ size = 32, token, isLP = false }) => {
  const image = images[isLP ? "LP" : token?.symbol ?? "DEFAULT"] ?? images.DEFAULT;

  return (
    <Container>
      <img src={image} alt={`${token?.symbol} Logo`} width={size} height={size} />
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;
