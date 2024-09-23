import React from "react";

import styled from "styled-components";

import { Token } from "@beanstalk/sdk";

import { ExpandBox } from "src/components/ExpandBox";
import { FC } from "src/types";
import useSdk from "src/utils/sdk/useSdk";

import { YieldSparkle } from "../Icons";
import { TextNudge } from "../Typography";

type Props = { token: Token | undefined };

function YieldDetails({ token }: Props) {
  return (
    <TextContainer>
      <div>
        Liquidity providers can earn yield by depositing {token?.symbol} LP in the Beanstalk Silo.
        You can add liquidity and deposit the LP token in the Silo in a single transaction on the{" "}
        <StyledLink
          href="https://app.bean.money/#/silo/0xbea0e11282e2bb5893bece110cf199501e872bad"
          target="_blank"
          rel="noopener noreferrer"
        >
          Beanstalk UI.
        </StyledLink>
      </div>
    </TextContainer>
  );
}

export const LearnYield: FC<Props> = ({ token }) => {
  const sdk = useSdk();
  const sdkToken = token ? sdk.tokens.findByAddress(token.address) : undefined;
  const isWhitelisted = sdkToken && sdk.tokens.siloWhitelist.has(sdkToken);
  if (!isWhitelisted) return null;

  return (
    <ExpandBox drawerHeaderText="How can I earn yield?">
      <ExpandBox.Header>
        <YieldSparkle />
        <TextNudge amount={1}>How can I earn yield?</TextNudge>
      </ExpandBox.Header>
      <ExpandBox.Body>
        <YieldDetails token={sdkToken} />
      </ExpandBox.Body>
    </ExpandBox>
  );
};

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: #4b5563;
`;

const StyledLink = styled.a`
  font-weight: 600;
  color: #4b5563;
  text-decoration-thickness: 1px;
`;
