import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";
import styled from "styled-components";
import { Page } from "src/components/Page";
import { LiquidityBox } from "src/components/Well/LiquidityBox";
import { Button } from "src/components/Swap/Button";
import { LearnYield } from "src/components/Well/LearnYield";
import { Item, Row } from "src/components/Layout";
import { LearnWellFunction } from "src/components/Well/LearnWellFunction";
import { LearnPump } from "src/components/Well/LearnPump";
import { TabButton } from "src/components/TabButton";
import { AddLiquidity } from "src/components/Liquidity/AddLiquidity";
import { RemoveLiquidity } from "src/components/Liquidity/RemoveLiquidity";
import { Log } from "src/utils/logger";
import { BodyXS, TextNudge } from "src/components/Typography";
import { ImageButton } from "src/components/ImageButton";
import { ChevronDown } from "src/components/Icons";
import { mediaQuery, size } from "src/breakpoints";
import { Loading } from "../components/Loading";
import { Error } from "../components/Error";
import { LoadingItem } from "src/components/LoadingItem";

export const Liquidity = () => {
  const { address: wellAddress } = useParams<"address">();
  const { well, loading, error } = useWell(wellAddress!);

  const navigate = useNavigate();

  const [wellFunctionName, setWellFunctionName] = useState<string>("This Well's Function");
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

  useEffect(() => {
    const run = async () => {
      if (well && well.wellFunction) {
        const _wellName = await well.wellFunction.contract.name();
        setWellFunctionName(_wellName);
      }
    };
    run();
  }, [well]);

  if (loading) return <Loading spinnerOnly />;

  if (error) {
    return <Error message={error?.message} errorOnly />;
  }

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
              onClick={() => navigate(`../wells/${wellAddress}`)}
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
                <LearnYield />
              </LoadingItem>
              <LoadingItem loading={loading} onLoading={<EmptyLearnItem />}>
                <LearnWellFunction name={wellFunctionName} />
              </LoadingItem>
              <LoadingItem loading={loading} onLoading={<EmptyLearnItem />}>
                <LearnPump />
              </LoadingItem>
            </LearnMoreButtons>
          </LearnMoreContainer>
        </SideBar>
        {/* <div style={{ display: "flex", flexDirection: "row", gap: "2px" }}> */}
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
              <TabButton onClick={() => setTab(1)} active={tab === 1} stretch bold justify hover>
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
          {tab === 1 && (
            <RemoveLiquidity
              well={well!}
              slippage={slippage}
              slippageSettingsClickHandler={slippageSettingsClickHandler}
              handleSlippageValueChange={handleSlippageValueChange}
            />
          )}
        </CenterBar>
        {/* <CenterBar id="centerbar" ref={scrollRef}>
            <AddRemoveLiquidityRow gap={0} tabSelected={true}>
              <Item stretch>
                <TabButton onClick={() => setTab(0)} active={tab === 0} stretch bold justify hover>
                  <LoadingItem loading={loading} onLoading={<>{""}</>}>
                    <span>Add Liquidity</span>
                  </LoadingItem>
                </TabButton>
              </Item>
              <Item stretch>
                <TabButton onClick={() => setTab(1)} active={tab === 1} stretch bold justify hover>
                  <LoadingItem loading={loading} onLoading={<>{""}</>}>
                    <span>Remove Liquidity</span>
                  </LoadingItem>
                </TabButton>
              </Item>
            </AddRemoveLiquidityRow>
            <AddLiquidityLoading />
          </CenterBar> */}
        {/* </div> */}
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
