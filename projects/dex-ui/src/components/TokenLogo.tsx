import { Token } from "@beanstalk/sdk";
import React from "react";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  size?: number;
  token?: Token;
};

export const TokenLogo: FC<Props> = ({ size = 32, token }) => {
  return (
    <Container>
      <img src={token?.logo} alt={`${token?.symbol} Logo`} width={size} height={size} />
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;
