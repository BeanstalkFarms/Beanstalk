import React, { useCallback, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useChainId } from "wagmi";

import { mediaQuery, size } from "src/breakpoints";
import { Error } from "src/components/Error";
import { ChevronDown } from "src/components/Icons";
import { ImageButton } from "src/components/ImageButton";
import { Item, Row } from "src/components/Layout";
import { AddLiquidity } from "src/components/Liquidity/AddLiquidity";
import { RemoveLiquidity } from "src/components/Liquidity/RemoveLiquidity";
import { LoadingItem } from "src/components/LoadingItem";
import { Page } from "src/components/Page";
import { Button } from "src/components/Swap/Button";
import { TabButton } from "src/components/TabButton";
import { BodyXS, TextNudge } from "src/components/Typography";
import { LearnPump } from "src/components/Well/LearnPump";
import { LearnWellFunction } from "src/components/Well/LearnWellFunction";
import { LearnYield } from "src/components/Well/LearnYield";
import { LiquidityBox } from "src/components/Well/LiquidityBox";
import { Log } from "src/utils/logger";
import { useWellWithParams } from "src/wells/useWellWithParams";

export const Liquidity = () => {
  const { well, loading, error } = useWellWithParams();
  const navigate = useNavigate();
  const chainId = useChainId();

  const [tab, setTab] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Slippage-related
  const [showSlippageSettings, setShowSlippageSettings] = useState<boolean>(false);
  const [slippage, setSlippage] = useState<number>(0.1);

  const slippageSettingsClickHandler = useCallback(() => {
    setShowSlippageSettings(!showSlippageSettings);
  }, [showSlippageSettings]);

  const handleSlippageValueChange = (value: string) => {
    Log.module("liquidity").debug(`Slippage changed: ${parseFloat(value)}`);
    setSlippage(parseFloat(value));
  };

  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => {
    setOpen(!open);
  }, [open]);

  if (error) {
    return <Error message={error?.message} errorOnly />;
  }

  const nonEmptyReserves = well && well?.reserves?.some((reserve) => reserve.gt(0));

  return (
    <Page>
      <ContentWrapper>
        <SideBar id="sidebar">
          <LoadingItem loading={loading} onLoading={<EmptyLearnItem />}>
            <Button
              secondary
              label="← Back To Well Details"
              width={"100%"}
              margin={"0px"}
              onClick={() => navigate(`../wells/${chainId.toString()}/${well?.address || ""}`)}
            />
          </LoadingItem>
          <LiquidityBox well={well} loading={loading} />
          <LearnMoreContainer>
            <LearnMoreLabel onClick={toggle}>
              <LearnMoreLine />
              <LearnMoreText>
                <TextNudge amount={2}>Learn more about this Well</TextNudge>
                <ImageButton
                  component={ChevronDown}
                  size={10}
                  rotate={open ? "180" : "0"}
                  onClick={toggle}
                  padding="0px"
                  alt="Click to expand and learn how to earn yield"
                  color={"#46B955"}
                />
              </LearnMoreText>
              <LearnMoreLine />
            </LearnMoreLabel>
            <LearnMoreButtons open={open}>
              <LoadingItem loading={loading} onLoading={<EmptyLearnItem />}>
                <LearnYield token={well?.lpToken} />
              </LoadingItem>
              <LoadingItem loading={loading} onLoading={<EmptyLearnItem />}>
                <LearnWellFunction well={well} />
              </LoadingItem>
              <LoadingItem loading={loading} onLoading={<EmptyLearnItem />}>
                <LearnPump well={well} />
              </LoadingItem>
            </LearnMoreButtons>
          </LearnMoreContainer>
        </SideBar>

        <CenterBar id="centerbar" ref={scrollRef}>
          <AddRemoveLiquidityRow gap={0} tabSelected={true}>
            <Item stretch>
              <TabButton onClick={() => setTab(0)} active={tab === 0} stretch bold justify hover>
                <LoadingItem loading={loading} onLoading={<>{""}</>}>
                  <span>Add Liquidity</span>
                </LoadingItem>
              </TabButton>
            </Item>
            <Item stretch>
              <TabButton
                onClick={() => setTab(1)}
                active={tab === 1}
                stretch
                bold
                justify
                hover
                disabled={!nonEmptyReserves}
              >
                <LoadingItem loading={loading} onLoading={<>{""}</>}>
                  <span>Remove Liquidity</span>
                </LoadingItem>
              </TabButton>
            </Item>
          </AddRemoveLiquidityRow>
          {tab === 0 && (
            <AddLiquidity
              well={well}
              loading={loading}
              slippage={slippage}
              slippageSettingsClickHandler={slippageSettingsClickHandler}
              handleSlippageValueChange={handleSlippageValueChange}
            />
          )}
          {tab === 1 && nonEmptyReserves && (
            <RemoveLiquidity
              well={well}
              loading={loading}
              slippage={slippage}
              slippageSettingsClickHandler={slippageSettingsClickHandler}
              handleSlippageValueChange={handleSlippageValueChange}
            />
          )}
        </CenterBar>
      </ContentWrapper>
    </Page>
  );
};

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: 48px;

  ${mediaQuery.lg.down} {
    flex-direction: column;
    gap: 16px;
  }

  ${mediaQuery.lg.only} {
    justify-content: flex-start;
  }
`;

const SideBar = styled.div`
  display: flex;
  flex-direction: column;
  width: calc(16 * 24px);
  min-width: calc(16 * 24px);
  gap: 24px;

  ${mediaQuery.lg.down} {
    width: 100%;
    min-width: 100%;
    gap: 16px;
  }
`;

const CenterBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;

  ${mediaQuery.md.up} {
    width: calc(17 * 24px);
    min-width: calc(17 * 24px);
  }

  ${mediaQuery.md.down} {
    width: 100%;
    min-width: 100%;
    gap: 16px;
  }
`;

const AddRemoveLiquidityRow = styled(Row)<{ tabSelected: boolean }>`
  @media (max-width: ${size.mobile}) {
    ${({ tabSelected }) =>
      !tabSelected &&
      `
    position: fixed; 
    bottom: 12px;
    width: calc(100% - 24px); 
    `}
  }
`;

const LearnMoreContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  order: 1;
  width: 100%;

  @media (min-width: ${size.mobile}) {
    gap: 24px;
    order: 0;
  }
`;
const LearnMoreLabel = styled.div`
  display: none;

  ${mediaQuery.lg.down} {
    display: flex;
    flex-direction: row;
  }
`;

const LearnMoreLine = styled.div`
  align-self: center;
  flex-grow: 1;
  border-top: 1px solid #9ca3af;
  flex-basis: 1fr;
`;

const LearnMoreText = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  width: 195px;
  color: #46b955;
  padding-right: 8px;
  padding-left: 8px;
  ${BodyXS}
  font-weight: 600;
`;

const LearnMoreButtons = styled.div<{ open: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 24px;

  ${mediaQuery.lg.down} {
    ${(props) => (props.open ? "display: flex" : "display: none")};
    gap: 16px;
  }
`;

const EmptyLearnItem = styled.div`
  width: 100%;
  height: 48px;
  border: 0.5px solid #9ca3af;
  background: #f9f8f6;
`;
