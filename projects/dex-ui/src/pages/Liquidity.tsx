import React, { ReactNode, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";
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
import { ChartSection } from "src/components/Well/Chart/ChartSection";
import { TabButton } from "src/components/TabButton";
import { OtherSection } from "src/components/Well/OtherSection";
import { WellHistory } from "src/components/Well/Activity/WellHistory";
import { AddLiquidity } from "src/components/Liquidity/AddLiquidity";
import { RemoveLiquidity } from "src/components/Liquidity/RemoveLiquidity";
import tripleCopyIcon from "/src/assets/images/triple-copy.svg";
import { Log } from "src/utils/logger";
import SlippagePanel from "src/components/Liquidity/SlippagePanel";


export const Liquidity = () => {
    
  const { address: wellAddress } = useParams<"address">();
  const navigate = useNavigate();
  const { well, loading, error } = useWell(wellAddress!);

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
  

  const [tab, setTab] = useState(0);
  const showTab = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>, i: number) => {
    (e.target as HTMLElement).blur();
    setTab(i);
  }, []);

  if (loading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;

    return(
        <Page>
        <ContentWrapper>
        <SideBar id="sidebar">
          <Button secondary label="← Back To Well Details" onClick={() => navigate(`../wells/${wellAddress}`)} />
          <LiquidityBox lpToken={well?.lpToken!} />
          <LearnYield />
          <LearnWellFunction name={"CHANGEME"} />
          <LearnPump />
        </SideBar>
        <SideBar id="centerbar">
        <Row gap={0}>
            <Item stretch>
              <TabButton onClick={(e) => showTab(e, 0)} active={tab === 0} stretch bold justify>
                <span>Add Liquidity</span>
              </TabButton>
            </Item>
            <Item stretch>
              <TabButton onClick={(e) => showTab(e, 1)} active={tab === 1} stretch bold justify>
                <span>Remove Liquidity</span>
              </TabButton>
            </Item>
          </Row>
        {tab === 0 && <AddLiquidity well={well!} txnCompleteCallback={() => console.log("complete")} slippage={slippage} slippageSettingsClickHandler={slippageSettingsClickHandler} handleSlippageValueChange={handleSlippageValueChange}/>}
        {tab === 1 && <RemoveLiquidity well={well!} txnCompleteCallback={() => console.log("complete")} slippage={slippage} slippageSettingsClickHandler={slippageSettingsClickHandler}  handleSlippageValueChange={handleSlippageValueChange}/> }
        </SideBar>
        <SideBar id="rightbar">
          <AboutBox>
            <AboutBoxContainer>
              <AboutBoxIcon src={tripleCopyIcon} alt={"Transaction Batching"} />
              <div>Add Liquidity and Deposit LP Tokens into the Silo in a single transaction on the Beanstalk Site.</div>
              <div />
              <AboutBoxLink href="https://app.bean.money/">Visit the Beanstalk Site</AboutBoxLink>
            </AboutBoxContainer>
          </AboutBox>
        </SideBar>
        </ContentWrapper>
        </Page>
    )
}

const ContentWrapper = styled.div`
  // outline: 1px solid red;
  display: flex;
  flex-direction: row;
  gap: 48px;
`;

const SideBar = styled.div`
  // outline: 1px solid green;
  display: flex;
  flex-direction: column;
  width: calc(17 * 24px);
  min-width: calc(17 * 24px);
  gap: 24px;
`;

const AboutBox = styled.div`
  width: 360px;
  border: 1px solid #9CA3AF;
  background-color: #EDF8EE;
`

const AboutBoxContainer = styled.div`
  padding: 12px;
  display: grid;
  grid-direction: column;
  grid-template-columns: 32px 1fr;
  align-items: center;
`

const AboutBoxIcon = styled.img`
  
`;

const AboutBoxLink = styled.a`
  font-weight: bold;
  color: black;
  margin-top: 8px;
`