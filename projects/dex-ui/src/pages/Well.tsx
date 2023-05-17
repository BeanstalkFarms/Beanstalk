import React, { ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { TokenValue } from "@beanstalk/sdk";
import { BodyL, BodyS, TextNudge } from "src/components/Typography";
import styled from "styled-components";
import { Title } from "src/components/PageComponents/Title";
import { Page } from "src/components/Page";
import { TokenLogo } from "src/components/TokenLogo";
import { Reserves } from "src/components/Well/Reserves";
import { LiquidityBox } from "src/components/Well/LiquidityBox";
import { Spinner2 } from "src/components/Spinner2";
import { Button } from "src/components/Swap/Button";
import { LearnYield } from "src/components/Well/LearnYield";
import { Item, Row } from "src/components/Layout";
import { LearnWellFunction } from "src/components/Well/LearnWellFunction";
import { LearnPump } from "src/components/Well/LearnPump";

export const Well = () => {
  const sdk = useSdk();
  const { address: wellAddress } = useParams<"address">();
  const { well, loading, error } = useWell(wellAddress!);
  const [prices, setPrices] = useState<(TokenValue | null)[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!well?.tokens) return;

      const prices = await Promise.all(well.tokens.map((t) => getPrice(t, sdk)));
      setPrices(prices);
    };

    run();
  }, [sdk, well?.tokens]);

  const title = (well?.tokens ?? []).map((t) => t.symbol).join("/");
  const logos: ReactNode[] = (well?.tokens || []).map((token) => <TokenLogo token={token} size={48} key={token.symbol} />);

  const reserves = (well?.reserves ?? []).map((amount, i) => {
    const token = well!.tokens![i];
    const price = prices[i];

    return {
      token,
      amount,
      dollarAmount: price ? amount.mul(price) : null
    };
  });
  const haveDollarAmounts = !reserves.find((r) => !r.dollarAmount);
  const totalUSD = reserves.reduce((total, r) => total.add(r.dollarAmount ?? TokenValue.ZERO), TokenValue.ZERO);

  const goLiquidity = () => {
    console.log("go liquidity");
  };
  const goSwap = () => {
    console.log("go goSwap");
  };

  if (loading)
    return (
      <Page>
        <Spinner2 size={72} />
      </Page>
    );

  // TODO: ERROR
  if (error)
    return (
      <Page>
        <div>ERROR: {error?.message}</div>
      </Page>
    );

  return (
    <Page>
      <Title title={title} parent={{ title: "Liquidity", path: "/wells" }} />
      <ContentWrapper>
        <MainContent>
          <Row>
            <Item>
              <Header>
                <TokenLogos>{logos}</TokenLogos>
                <TextNudge amount={10}>{title}</TextNudge>
              </Header>
            </Item>
            <Item column stretch right>
              <FunctionName>ConstantChangeMe</FunctionName>
              <Fee>4.20% Tradading Fee</Fee>
            </Item>
          </Row>
          <Reserves reserves={reserves} />
        </MainContent>
        <SideBar id="sidebar">
          <Row gap={24}>
            <Item stretch>
              <Button secondary label="Add/Rm Liquidity" onClick={goLiquidity} />
            </Item>
            <Item stretch>
              <Button label="Swap" onClick={goSwap} />
            </Item>
          </Row>
          <LiquidityBox lpToken={well?.lpToken!} />
          <LearnYield />
          <LearnWellFunction name={"CHANGEME"} />
          <LearnPump />
        </SideBar>
      </ContentWrapper>
    </Page>
  );
};

const Header = styled.div`
  display: flex;
  font-weight: 600;
  font-size: 32px;
  line-height: 32px;
  gap: 24px;
`;

const TokenLogos = styled.div`
  display: flex;
  div:not(:first-child) {
    margin-left: -8px;
  }
`;

const ContentWrapper = styled.div`
  // outline: 1px solid red;
  display: flex;
  flex-direction: row;
  gap: 48px;
`;
const MainContent = styled.div`
  // outline: 1px solid green;
  display: flex;
  flex-direction: column;
  width: calc(37 * 24px);
  min-width: calc(37 * 24px);
  gap: 24px;
`;
const SideBar = styled.div`
  // outline: 1px solid green;
  display: flex;
  flex-direction: column;
  width: calc(17 * 24px);
  min-width: calc(17 * 24px);
  gap: 24px;
`;

const FunctionName = styled.div`
  ${BodyL}
`;
const Fee = styled.div`
  ${BodyS}
  color: #4B5563;
`;
