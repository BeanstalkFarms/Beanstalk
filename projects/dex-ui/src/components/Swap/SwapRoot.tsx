import { Token, TokenValue } from "@beanstalk/sdk";
import React, { useCallback, useState } from "react";
import { useTokens } from "src/tokens/TokenProvider";
import styled from "styled-components";
import { ArrowButton } from "./ArrowButton";
import gear from "src/assets/images/gear.svg";
import { TokenInput } from "./TokenInput";
import { Image } from "../Image";

export const SwapRoot = () => {
  const tokens = useTokens();
  const [inAmount, setInAmount] = useState<TokenValue>();
  const [inToken, setInToken] = useState<Token>(tokens["WETH"]);
  const [outToken, setOutToken] = useState<Token>(tokens["BEAN"]);
  const [outAmount, setOutAmount] = useState<TokenValue>();

  const arrowHandler = () => {
    const prevInToken = inToken;
    const prevInAmount = inAmount;

    setInToken(outToken);
    setInAmount(outAmount);
    setOutToken(prevInToken);
    setOutAmount(prevInAmount);
  };

  const handleInputChange = useCallback((a: TokenValue) => setInAmount(a), []);
  const handleOutputChange = useCallback((a: TokenValue) => setOutAmount(a), []);

  const handleInputTokenChange = useCallback((token: Token) => {
    setInToken(token);
  }, []);
  const handleOutputTokenChange = useCallback((token: Token) => {
    setOutToken(token);
  }, []);

  console.log(` ${inAmount?.toHuman()} ${inToken?.symbol} => ${outAmount?.toHuman()} ${outToken?.symbol}`);

  return (
    <Container>
      <SwapHeaderContainer>
        <div>Swap</div>
        <div>
          <Image src={gear} size={16} alt="Transaction Settings" />
        </div>
      </SwapHeaderContainer>
      <Div>
        <SwapInputContainer>
          <TokenInput
            id="input-amount"
            label={`Input amount in ${inToken.symbol}`}
            token={inToken}
            amount={inAmount}
            onAmountChange={handleInputChange}
            onTokenChange={handleInputTokenChange}
            canChangeToken={true}
          />
        </SwapInputContainer>
        <ArrowContainer>
          <ArrowButton onClick={arrowHandler} />
        </ArrowContainer>

        <SwapInputContainer>
          <TokenInput
            id="output-amount"
            label={`Output amount in ${inToken.symbol}`}
            token={outToken}
            amount={outAmount}
            onAmountChange={handleOutputChange}
            onTokenChange={handleOutputTokenChange}
            canChangeToken={true}
            showBalance={true}
            showMax={false}
          />
        </SwapInputContainer>
      </Div>
      <SwapDetailsContainer>Details</SwapDetailsContainer>
      <SwapButtonContainer>Buttons</SwapButtonContainer>
    </Container>
  );
};

const Container = styled.div`
  width: 465px;
  display: flex;
  flex-direction: column;
  background: #1b1e2b;
  border-radius: 16px;
  padding: 12px;
  gap: 12px;
`;

const Div = styled.div`
  display: flex;
  flex-direction: column;
`;

const SwapHeaderContainer = styled.div`
  // border: 1px dotted blue;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 8px 12px;
  height: 36px;
  font-family: "Inter";
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 20px;
  align-items: center;
`;

const SwapInputContainer = styled.div`
  // border: 1px dashed green;
  display: flex;
  flex-direction: row;
  margin: 2.5px 0px;
`;
const ArrowContainer = styled.div`
  // border: 1px dashed orange;
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const SwapDetailsContainer = styled.div`
  // border: 1px dashed pink;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const SwapButtonContainer = styled.div`
  // border: 1px dashed pink;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;
