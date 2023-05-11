import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";
import { WellHistory } from "src/components/History/WellHistory";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import { LiquidityRoot } from "src/components/Liquidity/LiquidityRoot";
import { Spinner } from "src/components/Spinner";
import { getPrice, usePrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { TokenValue } from "@beanstalk/sdk";
import { H1 } from "src/components/Typography";
import styled from "styled-components";
import { Title } from "src/components/PageComponents/Title";

export const Well = () => {
  const { address: wellAddress } = useParams<"address">();
  const { well, loading, error } = useWell(wellAddress!);

  const title = (well?.tokens ?? []).map((t) => t.symbol).join(":");

  return (
    <Container>
      <Title title={title} parent={{ title: "Liquidity", path: "/wells" }} />
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;
