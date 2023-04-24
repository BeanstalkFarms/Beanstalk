import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "src/components/Swap/TokenInput";
import { Token, TokenValue } from "@beanstalk/sdk";
import { useAllTokensBalance } from "src/tokens/useTokenBalance";
import styled from "styled-components";
import { images } from "src/assets/images/tokens";
import { useAccount } from "wagmi";
import { ContractReceipt } from "ethers";
import { Well } from "@beanstalk/sdk/Wells";
import { useQuery } from "@tanstack/react-query";

type RemoveLiquidityProps = {
  well: Well;
};

enum REMOVE_LIQUIDITY_MODE {
  Balanced,
  OneToken,
  Custom
}

type LiquidityAmounts = {
  [key: number]: TokenValue;
};

export const RemoveLiquidity = ({ well }: RemoveLiquidityProps) => {
  const { address } = useAccount();

  const [wellTokens, setWellTokens] = useState<Token[]>();
  const [wellLpToken, setWellLpToken] = useState<Token | null>(null);
  const [lpTokenAmount, setLpTokenAmount] = useState<TokenValue | undefined>();
  const [receipt, setReceipt] = useState<ContractReceipt | null>(null);
  const [isLoadingAllBalances, setIsLoadingAllBalances] = useState(true);
  const [removeLiquidityMode, setRemoveLiquidityMode] = useState<REMOVE_LIQUIDITY_MODE>(REMOVE_LIQUIDITY_MODE.Balanced);
  const [singleTokenIndex, setSingleTokenIndex] = useState<number>(0);
  const [amounts, setAmounts] = useState<LiquidityAmounts>({});

  const { isLoading: isAllTokenLoading, refetch: refetchBalances } = useAllTokensBalance();

  const atLeastOneAmountNonzero = useCallback(() => Object.values(amounts).filter((amount) => amount.value.gt("0")).length > 0, [amounts]);

  useEffect(() => {
    const fetching = isAllTokenLoading;
    fetching ? setIsLoadingAllBalances(true) : setTimeout(() => setIsLoadingAllBalances(false), 500);
  }, [isAllTokenLoading]);

  useEffect(() => {
    if (well.tokens) {
      const tokens: Token[] = [];
      const initialAmounts: LiquidityAmounts = {};
      well.tokens.forEach((token, index) => {
        token.setMetadata({ logo: images[token.symbol] ?? images.DEFAULT });
        tokens.push(token);
        initialAmounts[index] = TokenValue.ZERO;
      });

      setWellTokens(tokens);
      setAmounts(initialAmounts);
    }
  }, [well]);

  useEffect(() => {
    if (well.lpToken) {
      let lpTokenWithMetadata = well.lpToken;
      lpTokenWithMetadata.setMetadata({ logo: images[well.lpToken.symbol] ?? images.DEFAULT });
      setLpTokenAmount(undefined);
      setWellLpToken(lpTokenWithMetadata);
    }
  }, [well]);

  const {
    data: balancedQuote,
    isLoading: loadingBalancedQuote,
    isError: balanedQuoteError
  } = useQuery(["wells", address, removeLiquidityMode, lpTokenAmount], async () => {
    if (!lpTokenAmount || removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Balanced) {
      return null;
    }

    return well.removeLiquidityQuote(lpTokenAmount);
  });

  const {
    data: oneTokenQuote,
    isLoading: loadingOneTokenQuote,
    isError: oneTokenQuoteError
  } = useQuery(["wells", address, removeLiquidityMode, lpTokenAmount, singleTokenIndex], async () => {
    if (!lpTokenAmount || removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.OneToken) {
      return null;
    }

    return well.removeLiquidityOneTokenQuote(lpTokenAmount, wellTokens![singleTokenIndex]);
  });

  const {
    data: customRatioQuote,
    isLoading: loadingCustomRatioQuote,
    isError: customRatioQuoteError
  } = useQuery(["wells", address, removeLiquidityMode, amounts], async () => {
    if (!atLeastOneAmountNonzero() || removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Custom) {
      return null;
    }

    return well.removeLiquidityImbalancedQuote(Object.values(amounts));
  });

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
        removeLiquidityTxn = await well.removeLiquidityOneToken(lpTokenAmount, wellTokens![singleTokenIndex], oneTokenQuote, address);
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
      refetchBalances();
    }
  }, [well.removeLiquidity, lpTokenAmount, oneTokenQuote, balancedQuote, address]);

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

  const removeLiquidityButtonEnabled = useMemo(() => address && lpTokenAmount, [address, lpTokenAmount]);
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
    setLpTokenAmount(TokenValue.ZERO);
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
                loading={isLoadingAllBalances}
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
                {wellTokens!.map((token, index) => (
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
                {wellTokens!.map((token, index) => (
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
                {wellTokens!.map((token, index) => (
                  <TokenContainer>
                    <TokenInput
                      id={`token${index}`}
                      label={`Input amount in ${token.symbol}`}
                      token={token}
                      amount={amounts[index]}
                      onAmountChange={handleImbalancedInputChange(index)}
                      canChangeToken={false}
                      showMax={false}
                      showBalance={false}
                      loading={isLoadingAllBalances}
                    />
                  </TokenContainer>
                ))}
              </div>
            )}
            {quoteError && <h2>Error loading quote</h2>}
            {receipt && <h2>{`txn hash: ${receipt.transactionHash.substring(0, 6)}...`}</h2>}
            {removeLiquidityButtonEnabled && <button onClick={removeLiquidityButtonClickHandler}>Remove Liquidity</button>}
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
