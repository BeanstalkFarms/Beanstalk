import React, { useCallback, useState } from "react";
import styled from "styled-components";
import { Well } from "@beanstalk/sdk/Wells";
import { AddLiquidity } from "./AddLiquidity";
import { RemoveLiquidity } from "./RemoveLiquidity";
import SlippagePanel from "./SlippagePanel";
import { Log } from "src/utils/logger";

type LiquidityRootProps = {
  well: Well;
  txnCompleteCallback: () => void;
};

export const LiquidityRoot = ({ well, txnCompleteCallback }: LiquidityRootProps) => {
  const [showRemove, setShowRemove] = useState<boolean>(false);

  // Slippage-related
  const [showSlippageSettings, setShowSlippageSettings] = useState<boolean>(false);
  const [slippage, setSlippage] = useState<number>(0.1);

  const slippageSettingsClickHandler = useCallback(() => {
    setShowSlippageSettings(!showSlippageSettings);
  }, [showSlippageSettings]);

  const handleSlippageValueChange = (value: string) => {
    Log.module("liquidityroot").debug(`Slippage changed: ${parseFloat(value)}`);
    setSlippage(parseFloat(value));
  };
  // /Slippage-related

  return (
    <Container>
      {showSlippageSettings && (
        <SlippagePanel
          slippageValue={slippage}
          closeModal={slippageSettingsClickHandler}
          slippageValueChanged={handleSlippageValueChange}
        />
      )}
      {!showSlippageSettings && (
        <>
          <Tabs>
            <Tab>
              <TabButton selected={!showRemove} onClick={() => setShowRemove(false)}>
                Add Liquidity
              </TabButton>
            </Tab>
            <Tab>
              <TabButton selected={showRemove} onClick={() => setShowRemove(true)}>
                Remove Liquidity
              </TabButton>
            </Tab>
          </Tabs>
          <div>
            {showRemove ? (
              <RemoveLiquidity
                slippage={slippage}
                slippageSettingsClickHandler={slippageSettingsClickHandler}
                well={well}
                txnCompleteCallback={txnCompleteCallback}
              />
            ) : (
              <AddLiquidity
                well={well}
                txnCompleteCallback={txnCompleteCallback}
                slippageSettingsClickHandler={slippageSettingsClickHandler}
                slippage={slippage}
              />
            )}
          </div>
        </>
      )}
    </Container>
  );
};

type TabButtonProps = {
  selected?: boolean;
};

const TabButton = styled.button<TabButtonProps>`
  height: 50px;
  border-radius: 0px;
  width: 100%;
  font-weight: ${(props) => (props.selected ? "bold" : "normal")};
  text-decoration: ${(props) => (props.selected ? "underline" : "none")};
`;

const Tab = styled.div`
  display: flex;
  width: 100%;
`;

const Tabs = styled.div`
  display: flex;
  flex-direction: row;
`;

const Container = styled.div`
  width: 490px;
  display: flex;
  flex-direction: column;
  background: #1b1e2b;
  border-radius: 5px;
  padding: 12px;
  gap: 12px;
`;
