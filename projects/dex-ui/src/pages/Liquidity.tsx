import React, { useCallback, useEffect, useState } from "react";
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
import { size } from "src/breakpoints";

export const Liquidity = () => {
  const { address: wellAddress } = useParams<"address">();
  const navigate = useNavigate();
  const { well, loading, error } = useWell(wellAddress!);
  const [wellFunctionName, setWellFunctionName] = useState<string>("This Well's Function");
  const [isMobile, setIsMobile] = useState(window.matchMedia(`(max-width: ${size.mobile})`).matches);
  const [tab, setTab] = useState(isMobile ? null : 0);

  // Media query
  useEffect(() => {
    window.matchMedia(`(max-width: ${size.mobile})`).addEventListener("change", (event) => setIsMobile(event.matches));

    return () => {
      window.matchMedia(`(max-width: ${size.mobile})`).removeEventListener("change", (event) => setIsMobile(event.matches));
    };
  }, []);

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
  // /Slippage-related

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

  if (loading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;

  return (
    <Page>
      <ContentWrapper>
        <SideBar id="sidebar">
          <Button
            secondary
            label="← Back To Well Details"
            width={isMobile ? "100vw" : "100%"}
            margin={isMobile ? "-12px -11px 0px -12px" : "0"}
            onClick={() => navigate(`../wells/${wellAddress}`)}
          />
          {(tab === null && isMobile) || !isMobile ? (
            <>
              <LiquidityBox lpToken={well?.lpToken!} />
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
                  <LearnYield />
                  <LearnWellFunction name={wellFunctionName} />
                  <LearnPump />
                </LearnMoreButtons>
              </LearnMoreContainer>
            </>
          ) : null}
        </SideBar>
        <CenterBar id="centerbar">
          <AddRemoveLiquidityRow gap={0} tabSelected={tab === 0 || tab === 1}>
            <Item stretch>
              <TabButton onClick={() => setTab(isMobile && tab === 0 ? null : 0)} active={tab === 0} stretch bold justify hover>
                <span>Add Liquidity</span>
              </TabButton>
            </Item>
            <Item stretch>
              <TabButton onClick={() => setTab(isMobile && tab === 1 ? null : 1)} active={tab === 1} stretch bold justify hover>
                <span>Remove Liquidity</span>
              </TabButton>
            </Item>
          </AddRemoveLiquidityRow>
          {tab === 0 && (
            <AddLiquidity
              well={well!}
              txnCompleteCallback={() => console.log("complete")}
              slippage={slippage}
              slippageSettingsClickHandler={slippageSettingsClickHandler}
              handleSlippageValueChange={handleSlippageValueChange}
            />
          )}
          {tab === 1 && (
            <RemoveLiquidity
              well={well!}
              txnCompleteCallback={() => console.log("complete")}
              slippage={slippage}
              slippageSettingsClickHandler={slippageSettingsClickHandler}
              handleSlippageValueChange={handleSlippageValueChange}
            />
          )}
        </CenterBar>
        <SideBar id="leftbar" />
      </ContentWrapper>
    </Page>
  );
};

const ContentWrapper = styled.div`
  // outline: 1px solid red;
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 48px;
  @media (max-width: ${size.mobile}) {
    flex-direction: column;
    gap: 16px;
  }
`;

const SideBar = styled.div`
  // outline: 1px solid green;
  display: flex;
  flex-direction: column;
  width: calc(16 * 24px);
  min-width: calc(16 * 24px);
  gap: 24px;
  @media (max-width: ${size.mobile}) {
    width: 100%;
    min-width: 100%;
    gap: 16px;
  }
`;

const CenterBar = styled.div`
  // outline: 1px solid green;
  display: flex;
  flex-direction: column;
  width: calc(17 * 24px);
  min-width: calc(17 * 24px);
  gap: 24px;
  @media (max-width: ${size.mobile}) {
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
  display: flex;
  flex-direction: row;
  @media (min-width: ${size.mobile}) {
    display: none;
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
  ${(props) => (props.open ? "display: flex" : "display: none")};
  flex-direction: column;
  gap: 16px;
  @media (min-width: ${size.mobile}) {
    display: flex;
    gap: 24px;
  }
`;
