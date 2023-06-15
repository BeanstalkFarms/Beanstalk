/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "src/components/Swap/TokenInput";
import { Token, TokenValue } from "@beanstalk/sdk";
import styled from "styled-components";
import { images } from "src/assets/images/tokens";
import { useAccount } from "wagmi";
import { Well } from "@beanstalk/sdk/Wells";
import { useLiquidityQuote } from "src/wells/useLiquidityQuote";
import { LIQUIDITY_OPERATION_TYPE, REMOVE_LIQUIDITY_MODE } from "./types";
import { Button } from "../Swap/Button";
import { ensureAllowance, hasMinimumAllowance } from "./allowance";
import { Log } from "../../utils/logger";
import QuoteDetails from "./QuoteDetails";
import { TabButton } from "../TabButton";
import { TransactionToast } from "../TxnToast/TransactionToast";
import useSdk from "src/utils/sdk/useSdk";
import { getPrice } from "src/utils/price/usePrice";
import { useWellReserves } from "src/wells/useWellReserves";
import { Checkbox } from "../Checkbox";

type RemoveLiquidityProps = {
  well: Well;
  txnCompleteCallback: () => void;
  slippage: number;
  slippageSettingsClickHandler: () => void;
  handleSlippageValueChange: (value: string) => void;
};

export const RemoveLiquidity = ({ well, txnCompleteCallback, slippage, slippageSettingsClickHandler, handleSlippageValueChange }: RemoveLiquidityProps) => {
  const { address } = useAccount();

  const [wellLpToken, setWellLpToken] = useState<Token | null>(null);
  const [lpTokenAmount, setLpTokenAmount] = useState<TokenValue | undefined>();
  const [removeLiquidityMode, setRemoveLiquidityMode] = useState<REMOVE_LIQUIDITY_MODE>(REMOVE_LIQUIDITY_MODE.Balanced);
  const [singleTokenIndex, setSingleTokenIndex] = useState<number>(0);
  const [amounts, setAmounts] = useState<TokenValue[]>([]);
  const [prices, setPrices] = useState<(TokenValue | null)[]>();

  const sdk = useSdk();
  const { reserves: wellReserves, refetch: refetchWellReserves }  = useWellReserves(well);

  useEffect(() => {
    const run = async () => {
      if (!well.tokens) return;
      const prices = await Promise.all(well.tokens.map((t) => getPrice(t, sdk)));
      setPrices(prices);
    };
    run();
  }, [sdk, well?.tokens]);

  const { balanced, oneToken, custom } = useLiquidityQuote(
    well,
    removeLiquidityMode,
    lpTokenAmount || TokenValue.ZERO,
    singleTokenIndex,
    well.tokens!,
    amounts
  );

  const { balancedQuote } = balanced;
  const { oneTokenQuote } = oneToken;
  const { customRatioQuote } = custom;

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
      setLpTokenAmount(customRatioQuote.quote);
    }
  }, [customRatioQuote]);

  const resetState = useCallback(() => {
    if (well.tokens) {
      const initialAmounts = []
      for (let i = 0; i < well.tokens.length; i++) {
        initialAmounts[i] = TokenValue.ZERO
      }

      setAmounts([...initialAmounts]);
      setLpTokenAmount(undefined);
    }
  }, [well.tokens]);

  const removeLiquidityButtonClickHandler = useCallback(async () => {
    const hasQuote = oneTokenQuote || balancedQuote || customRatioQuote;

    if (hasQuote && address && lpTokenAmount) {
      const toast = new TransactionToast({
        loading: "Removing liquidity...",
        error: "Removal failed",
        success: "Liquidity removed"
      }); 
      let removeLiquidityTxn;
      try {
        if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken) {
          if (!oneTokenQuote) {
            return;
          }
          const quoteAmountLessSlippage = oneTokenQuote.quote.subSlippage(slippage);
          removeLiquidityTxn = await well.removeLiquidityOneToken(
            lpTokenAmount,
            well.tokens![singleTokenIndex],
            quoteAmountLessSlippage,
            address
          );
          toast.confirming(removeLiquidityTxn);
        } else if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced) {
          if (!balancedQuote) {
            return;
          }
          const quoteAmountLessSlippage = balancedQuote.quote.map((q) => q.subSlippage(slippage));
          removeLiquidityTxn = await well.removeLiquidity(lpTokenAmount, quoteAmountLessSlippage, address);
          toast.confirming(removeLiquidityTxn);
        } else {
          if (!customRatioQuote) {
            return;
          }
          const quoteAmountWithSlippage = lpTokenAmount.addSlippage(slippage);
          removeLiquidityTxn = await well.removeLiquidityImbalanced(quoteAmountWithSlippage, amounts, address);
          toast.confirming(removeLiquidityTxn);
        }
        const receipt = await removeLiquidityTxn.wait();
        toast.success(receipt);
        resetState();
        refetchWellReserves();
        txnCompleteCallback();
        } catch (error) {
          Log.module("RemoveLiquidity").error("Error removing liquidity: ", (error as Error).message);
          toast.error(error);
        }
    }
  }, [
    well,
    lpTokenAmount,
    oneTokenQuote,
    amounts,
    removeLiquidityMode,
    singleTokenIndex,
    customRatioQuote,
    balancedQuote,
    address,
    txnCompleteCallback,
    resetState,
    slippage,
    refetchWellReserves
  ]);

  const handleSwitchRemoveMode = (newMode: REMOVE_LIQUIDITY_MODE) => {
    const currentMode = removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Custom || removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced
    const _newMode = newMode === REMOVE_LIQUIDITY_MODE.Custom || newMode === REMOVE_LIQUIDITY_MODE.Balanced
    if (currentMode && _newMode) {
      setRemoveLiquidityMode(newMode);
    } else {
      setLpTokenAmount(TokenValue.ZERO);
      setRemoveLiquidityMode(newMode);
    }
  };

  const handleInputChange = useCallback(
    (amountFromInput: TokenValue) => {
      if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Custom) {
        setRemoveLiquidityMode(REMOVE_LIQUIDITY_MODE.Balanced)
      }
      setLpTokenAmount(amountFromInput);
    },
    [setLpTokenAmount, removeLiquidityMode]
  );

  const handleSwitchSingleToken = (selectedTokenIndex: number) => {
    setSingleTokenIndex(selectedTokenIndex);
  };

  const handleImbalancedInputChange = useCallback(
    (index: number) => (amount: TokenValue) => {
      let _newAmounts = [...amounts]
      _newAmounts[index] = amount
      for (let i = 0; i < well.tokens!.length; i++) {
        _newAmounts[i] = _newAmounts[i] ? _newAmounts[i] : i === index ? amount : TokenValue.ZERO;
      }
      setAmounts([..._newAmounts]);
    },
    [amounts, well.tokens]
  );

  const lpTokenAmountNonZero = useMemo(() => lpTokenAmount && lpTokenAmount.gt(0), [lpTokenAmount]);

  const removeLiquidityButtonEnabled = useMemo(() => address && lpTokenAmountNonZero, [address, lpTokenAmountNonZero]);

  const buttonLabel = useMemo(() => (lpTokenAmountNonZero ? "Remove Liquidity" : "Input Token Amount"), [lpTokenAmountNonZero]);

  const [tokenAllowance, setTokenAllowance] = useState<boolean>(false);

  const checkMinAllowanceForLpToken = useCallback(async () => {
    if (!address || !wellLpToken) {
      return;
    }

    if (lpTokenAmount && lpTokenAmount.gt(0)) {
      const tokenHasMinAllowance = await hasMinimumAllowance(address, well.address, wellLpToken, lpTokenAmount);
      Log.module("addliquidity").debug(
        `Token ${wellLpToken.symbol} with amount ${lpTokenAmount.toHuman()} has approval ${tokenHasMinAllowance}`
      );
      setTokenAllowance(tokenHasMinAllowance);
    } else {
      setTokenAllowance(false);
    }
  }, [address, lpTokenAmount, well.address, wellLpToken]);

  const approveTokenButtonClickHandler = useCallback(async () => {
    if (!address || !well.lpToken || !lpTokenAmount) {
      return;
    }

    await ensureAllowance(address, well.address, well.lpToken, lpTokenAmount);
    checkMinAllowanceForLpToken();
  }, [address, well.lpToken, well.address, lpTokenAmount, checkMinAllowanceForLpToken]);

  useEffect(() => {
    if (!address) {
      return;
    }
    if (!well.tokens) {
      return;
    }

    if (!lpTokenAmount) {
      return;
    }

    checkMinAllowanceForLpToken();
  }, [well.tokens, address, lpTokenAmount, checkMinAllowanceForLpToken]);

  const approveButtonDisabled = !tokenAllowance && !!lpTokenAmount && lpTokenAmount.lte(TokenValue.ZERO);

  const selectedQuote = useMemo(() => {
    if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken) {
      if (!oneTokenQuote) {
        return null;
      }
      return oneTokenQuote;
    } else if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced) {
      if (!balancedQuote) {
        return null;
      }
      return balancedQuote;
    } else {
      if (!customRatioQuote) {
        return null;
      }
      return customRatioQuote;
    }
  }, [removeLiquidityMode, oneTokenQuote, balancedQuote, customRatioQuote]);

  useEffect(() => {
    const nonZeroValues = amounts.filter((amount) => amount && amount.value.gt("0")).length;
    if (nonZeroValues === 0) {
      setLpTokenAmount(undefined)
    }
  }, [amounts])

  return (
    <div>
      {wellLpToken && (
        <LargeGapContainer>
            <TokenContainer>
              <TokenInput
                id={"inputLpToken"}
                label={`Input amount in ${wellLpToken.symbol}`}
                token={wellLpToken}
                amount={lpTokenAmount}
                onAmountChange={handleInputChange}
                canChangeToken={false}
                canChangeValue={removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Custom}
                showBalance={true}
                loading={false}
              />
            </TokenContainer>
            <MediumGapContainer>
            <OutputModeSelectorContainer>
            <div>Claim LP Tokens as</div>
            <Tabs>
              <Tab>
                <TabButton onClick={() => handleSwitchRemoveMode(REMOVE_LIQUIDITY_MODE.OneToken)} active={removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken} stretch>
                <TabRadio
                  type="radio"
                  id="singleTokenRadio"
                  value={REMOVE_LIQUIDITY_MODE.Balanced}
                  checked={removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken}
                  onChange={() => handleSwitchRemoveMode(REMOVE_LIQUIDITY_MODE.OneToken)}
                />{" "}
                <TabLabel onClick={() => handleSwitchRemoveMode(REMOVE_LIQUIDITY_MODE.OneToken)}>Single Token</TabLabel>
                </TabButton>
              </Tab>
              <Tab>
              <TabButton onClick={() => handleSwitchRemoveMode(REMOVE_LIQUIDITY_MODE.Balanced)} active={removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.OneToken} stretch>
                <TabRadio
                  type="radio"
                  value={REMOVE_LIQUIDITY_MODE.Balanced}
                  checked={removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.OneToken}
                  readOnly
                />
                <TabLabel onClick={() => handleSwitchRemoveMode(REMOVE_LIQUIDITY_MODE.Balanced)}>Multiple Tokens</TabLabel>
                </TabButton>
              </Tab>
            </Tabs>
            </OutputModeSelectorContainer>
            {removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.OneToken && (
              <>
                {well.tokens!.map((token: Token, index: number) => (
                  <TokenContainer key={`tokencontainer1${index}`}>
                    <TokenInput
                      key={`token${index}`}
                      id={`token${index}`}
                      label={`Input amount in ${token.symbol}`}
                      token={token}
                      amount={
                        removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced
                          ? balancedQuote
                            ? balancedQuote.quote[index]
                            : TokenValue.ZERO
                          : amounts[index]
                      }
                      onAmountChange={handleImbalancedInputChange(index)}
                      canChangeToken={false}
                      canChangeValue={removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Custom}
                      showBalance={false}
                      loading={false}
                    />
                  </TokenContainer>
                ))}
              </>
            )}
            {removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken && (
              <MediumGapContainer>
                {well.tokens!.map((token: Token, index: number) => (
                  <ContainerSingleTokenRow key={`token${index}`} onClick={() => handleSwitchSingleToken(index)}>
                    <ReadOnlyTokenValueRow selected={singleTokenIndex === index}>
                      <Radio
                        type="radio"
                        name="singleToken"
                        value={index}
                        checked={singleTokenIndex === index}
                        readOnly
                      />
                      <SmallTokenLogo src={token.logo} />
                      <TokenSymbol>{token.symbol}</TokenSymbol>
                      {singleTokenIndex === index ? (
                        <TokenAmount>{oneTokenQuote ? oneTokenQuote.quote.toHuman() : "0"}</TokenAmount>
                      ) : (
                        <TokenAmount>{"0"}</TokenAmount>
                      )}
                    </ReadOnlyTokenValueRow>
                  </ContainerSingleTokenRow>
                ))}
              </MediumGapContainer>
            )}
            </MediumGapContainer>
            {removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.OneToken && (
              <>
              <Checkbox 
                label={"Claim in balanced proportion"}
                checked={removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced}
                onClick={() =>
                  handleSwitchRemoveMode(
                    removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Custom ? REMOVE_LIQUIDITY_MODE.Balanced : REMOVE_LIQUIDITY_MODE.Custom
                  )}
                />
              </>
            )}
            {lpTokenAmountNonZero && (
              <QuoteDetails
                type={LIQUIDITY_OPERATION_TYPE.REMOVE}
                quote={selectedQuote}
                lpTokenAmount={lpTokenAmount}
                inputs={amounts}
                wellLpToken={well.lpToken}
                slippageSettingsClickHandler={slippageSettingsClickHandler}
                handleSlippageValueChange={handleSlippageValueChange}
                slippage={slippage}
                wellTokens={well.tokens}
                removeLiquidityMode={removeLiquidityMode}
                selectedTokenIndex={singleTokenIndex}
                tokenPrices={prices}
                tokenReserves={wellReserves}
              />
            )}
            {!tokenAllowance ? (
              <ButtonWrapper>
                <ApproveTokenButton
                  disabled={approveButtonDisabled}
                  loading={false}
                  label={`Approve ${wellLpToken.symbol}`}
                  onClick={approveTokenButtonClickHandler}
                />
              </ButtonWrapper>
            ) : (
              <ButtonWrapper>
              <Button
                disabled={!removeLiquidityButtonEnabled}
                label={buttonLabel}
                onClick={removeLiquidityButtonClickHandler}
                loading={false}
              />
            </ButtonWrapper>
            )}
        </LargeGapContainer>
      )}
    </div>
  );
};

type ReadOnlyRowProps = {
  selected?: boolean
}

const LargeGapContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`

const MediumGapContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const TabLabel = styled.div`
  cursor: pointer;
`;

const Tab = styled.div`
  display: flex;
  width: 100%;
`;

const Tabs = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
`;

const ApproveTokenButton = styled(Button)`
`;

const ButtonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 10px;
  :last-of-type {
    margin-bottom: 0;
  }
`;

const TabRadio = styled.input`
  // TODO: Somehow the default input styled
  // Are not showing the radio buttons
  margin-right: 10px;
  width: 1em;
  height: 1em;
  outline: none;
  border: none;
  background-color: #F9F8F6;
  &:checked {
    background-color: white;
  }
  cursor: pointer;
`;

const Radio = styled.input`
  // TODO: Somehow the default input styled
  // Are not showing the radio buttons
  margin-right: 10px;
  width: 1.4em;
  height: 1.4em;
  outline: none;
  border: none;
  background-color: #F9F8F6;
  &:checked {
    background-color: white;
  }
  cursor: pointer;
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

const ReadOnlyTokenValueRow = styled.div<ReadOnlyRowProps>`
  display: flex;
  flex-direction: row;
  font-weight: ${(props) => props.selected ? '600' : 'normal'};
  background-color: ${(props) => props.selected ? 'white' : '#F9F8F6'};
  border: 1px solid black;
  margin: -1px;
  height: 60px;
  align-items: center;
  padding-left: 8px;
  padding-right: 8px;
`;

const TokenContainer = styled.div`
  width: full;
  display: flex;
  flex-direction: column;
`;

const ContainerSingleTokenRow = styled.div`
  width: full;
  display: flex;
  flex-direction: column;
  cursor: pointer;
`;

const OutputModeSelectorContainer = styled.div`
`
