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

export const Liquidity = () => {
    
  const { address: wellAddress } = useParams<"address">();
  const navigate = useNavigate();
  const { well, loading, error } = useWell(wellAddress!);
  const [ wellFunctionName, setWellFunctionName ] = useState<string>("This Well's Function")

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
  
  useEffect(() => {
    const run  = async() => {
      if (well && well.wellFunction) {
        const _wellName = await well.wellFunction.contract.name();
        setWellFunctionName(_wellName);
      }
    };
    run();
  }, [well])

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
            <LearnWellFunction name={wellFunctionName} />
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