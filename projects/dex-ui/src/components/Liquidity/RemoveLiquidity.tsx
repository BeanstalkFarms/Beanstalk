import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "src/components/Swap/TokenInput";
import { Token, TokenValue } from "@beanstalk/sdk";
import styled from "styled-components";
import { images } from "src/assets/images/tokens";
import { useAccount } from "wagmi";
import { ContractReceipt } from "ethers";
import { Well } from "@beanstalk/sdk/Wells";
import { useLiquidityQuote } from "src/wells/useLiquidityQuote";
import { LiquidityAmounts, REMOVE_LIQUIDITY_MODE } from "./types";
import { Button } from "../Swap/Button";

type RemoveLiquidityProps = {
  well: Well;
  txnCompleteCallback: () => void;
};

export const RemoveLiquidity = ({ well, txnCompleteCallback }: RemoveLiquidityProps) => {
  const { address } = useAccount();

  const [wellLpToken, setWellLpToken] = useState<Token | null>(null);
  const [lpTokenAmount, setLpTokenAmount] = useState<TokenValue | undefined>();
  const [receipt, setReceipt] = useState<ContractReceipt | null>(null);
  const [removeLiquidityMode, setRemoveLiquidityMode] = useState<REMOVE_LIQUIDITY_MODE>(REMOVE_LIQUIDITY_MODE.Balanced);
  const [singleTokenIndex, setSingleTokenIndex] = useState<number>(0);
  const [amounts, setAmounts] = useState<LiquidityAmounts>({});

  const { balanced, oneToken, custom } = useLiquidityQuote(
    well,
    removeLiquidityMode,
    lpTokenAmount || TokenValue.ZERO,
    singleTokenIndex,
    well.tokens!,
    amounts
  );

  const { balancedQuote, loadingBalancedQuote, balanedQuoteError } = balanced;
  const { oneTokenQuote, loadingOneTokenQuote, oneTokenQuoteError } = oneToken;
  const { customRatioQuote, loadingCustomRatioQuote, customRatioQuoteError } = custom;

  useEffect(() => {
    if (well.tokens) {
      const initialAmounts: LiquidityAmounts = {};
      for (let i = 0; i < well.tokens.length; i++) {
        initialAmounts[i] = TokenValue.ZERO;
      }
      setAmounts(initialAmounts);
    }
  }, [well.tokens]);

  useEffect(() => {
    if (well.lpToken) {
      let lpTokenWithMetadata = well.lpToken;
      lpTokenWithMetadata.setMetadata({ logo: images[well.lpToken.symbol] ?? images.DEFAULT });
      setLpTokenAmount(undefined);
      setWellLpToken(lpTokenWithMetadata);
    }
  }, [well.lpToken]);

  useEffect(() => {
    if (customRatioQuote) {
      setLpTokenAmount(customRatioQuote);
    }
  }, [customRatioQuote]);

  const removeLiquidityButtonClickHandler = useCallback(async () => {
    const hasQuote = oneTokenQuote || balancedQuote || customRatioQuote;
    if (hasQuote && address && lpTokenAmount) {
      let removeLiquidityTxn;
      if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken) {
        if (!oneTokenQuote) {
          return;
        }
        removeLiquidityTxn = await well.removeLiquidityOneToken(lpTokenAmount, well.tokens![singleTokenIndex], oneTokenQuote, address);
      } else if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced) {
        if (!balancedQuote) {
          return;
        }
        removeLiquidityTxn = await well.removeLiquidity(lpTokenAmount, balancedQuote, address);
      } else {
        if (!customRatioQuote) {
          return;
        }
        removeLiquidityTxn = await well.removeLiquidityImbalanced(lpTokenAmount, Object.values(amounts), address);
      }

      const receipt = await removeLiquidityTxn.wait();
      setReceipt(receipt);
      txnCompleteCallback();
    }
  }, [
    oneTokenQuote,
    balancedQuote,
    customRatioQuote,
    address,
    lpTokenAmount,
    removeLiquidityMode,
    well,
    singleTokenIndex,
    amounts,
    txnCompleteCallback
  ]);

  const handleInputChange = useCallback(
    (amountFromInput: TokenValue) => {
      setLpTokenAmount(amountFromInput);
    },
    [setLpTokenAmount]
  );

  const handleSwitchRemoveMode = (newMode: REMOVE_LIQUIDITY_MODE) => {
    setRemoveLiquidityMode(newMode);
  };

  const handleSwitchSingleToken = (selectedTokenIndex: number) => {
    setSingleTokenIndex(selectedTokenIndex);
  };

  const handleImbalancedInputChange = useCallback(
    (index: number) => (amount: TokenValue) => {
      setAmounts({ ...amounts, [index]: amount });
    },
    [amounts]
  );

  const removeLiquidityButtonEnabled = useMemo(() => address && lpTokenAmount && lpTokenAmount.gt(0), [address, lpTokenAmount]);
  const loadingQuote = useMemo(
    () => loadingBalancedQuote || loadingOneTokenQuote || loadingCustomRatioQuote,
    [loadingBalancedQuote, loadingOneTokenQuote, loadingCustomRatioQuote]
  );
  const quoteError = useMemo(
    () => balanedQuoteError || oneTokenQuoteError || customRatioQuoteError,
    [balanedQuoteError, oneTokenQuoteError, customRatioQuoteError]
  );

  useEffect(() => {
    // TODO: A little more complicated
    // If we are leaving custom mode, reset to 0
    // If we are entering custom mode, reset to 0
    // If we are switching between balanced and one token, don't reset
    setLpTokenAmount(undefined);
  }, [removeLiquidityMode]);
  return (
    <div>
      {wellLpToken && (
        <div>
          <h1>Remove Liquidity</h1>
          <div>
            <TokenContainer>
              <TokenInput
                id={"inputLpToken"}
                label={`Input amount in ${wellLpToken.symbol}`}
                token={wellLpToken}
                amount={lpTokenAmount}
                onAmountChange={handleInputChange}
                canChangeToken={false}
                canChangeValue={removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Custom}
                showBalance={removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Custom}
                showMax={removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Custom}
                loading={false}
              />
            </TokenContainer>
            {loadingQuote && <h2>Loading Quote...</h2>}
            <div>
              <button onClick={() => handleSwitchRemoveMode(REMOVE_LIQUIDITY_MODE.Balanced)}>Balanced</button>
              <button onClick={() => handleSwitchRemoveMode(REMOVE_LIQUIDITY_MODE.OneToken)}>One Coin</button>
              <button onClick={() => handleSwitchRemoveMode(REMOVE_LIQUIDITY_MODE.Custom)}>Custom Ratio</button>
            </div>
            {removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced && (
              <div>
                {well.tokens!.map((token, index) => (
                  <TokenContainer key={`token${index}`}>
                    <ReadOnlyTokenValueRow>
                      <SmallTokenLogo src={token.logo} />
                      <TokenSymbol>{token.symbol}</TokenSymbol>
                      <TokenAmount>{balancedQuote ? balancedQuote[index].toHuman() : ""}</TokenAmount>
                    </ReadOnlyTokenValueRow>
                  </TokenContainer>
                ))}
              </div>
            )}
            {removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken && (
              <div>
                {well.tokens!.map((token, index) => (
                  <TokenContainer key={`token${index}`}>
                    <ReadOnlyTokenValueRow>
                      <div>
                        <Radio
                          type="radio"
                          name="singleToken"
                          value={index}
                          checked={singleTokenIndex === index}
                          onChange={() => handleSwitchSingleToken(index)}
                        />
                      </div>
                      <SmallTokenLogo src={token.logo} />
                      <TokenSymbol>{token.symbol}</TokenSymbol>
                      {singleTokenIndex === index ? (
                        <TokenAmount>{oneTokenQuote ? oneTokenQuote.toHuman() : ""}</TokenAmount>
                      ) : (
                        <TokenAmount>{""}</TokenAmount>
                      )}
                    </ReadOnlyTokenValueRow>
                  </TokenContainer>
                ))}
              </div>
            )}
            {removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Custom && (
              <div>
                {/*
                   // TODO: 
                   We could initially we set the amounts from the quote
                   But if they change, reverse quote
                   */}
                {well.tokens!.map((token, index) => (
                  <TokenContainer key={index}>
                    <TokenInput
                      id={`token${index}`}
                      label={`Input amount in ${token.symbol}`}
                      token={token}
                      amount={amounts[index]}
                      onAmountChange={handleImbalancedInputChange(index)}
                      canChangeToken={false}
                      showMax={false}
                      showBalance={false}
                      loading={false}
                    />
                  </TokenContainer>
                ))}
              </div>
            )}
            {quoteError && <h2>Error loading quote</h2>}
            {receipt && <h2>{`txn hash: ${receipt.transactionHash.substring(0, 6)}...`}</h2>}
            {/* {removeLiquidityButtonEnabled && <button onClick={removeLiquidityButtonClickHandler}>Remove Liquidity</button>} */}
            <Button
              disabled={!removeLiquidityButtonEnabled}
              label="Remove Liquidity"
              onClick={removeLiquidityButtonClickHandler}
              loading={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const Radio = styled.input`
  // TODO: Somehow the default input styled
  // Are not showing the radio buttons
  margin-right: 10px;
  width: 1em;
  height: 1em;
  background-color: white;
  border-radius: 50%;

  :checked {
    background-color: yellow;
  }
`;

const TokenAmount = styled.div`
  width: 100%;
  text-align: right;
`;

const TokenSymbol = styled.div`
  margin-left: 10px;
`;

const SmallTokenLogo = styled.img`
  width: 20px;
  height: 20px;
`;

const ReadOnlyTokenValueRow = styled.div`
  display: flex;
  flex-direction: row;
`;

const TokenContainer = styled.div`
  width: 465px;
  display: flex;
  flex-direction: column;
  background: #1b1e2b;
  border-radius: 16px;
  padding: 12px;
  gap: 12px;
`;
