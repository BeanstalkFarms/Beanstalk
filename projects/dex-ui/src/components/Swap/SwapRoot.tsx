import { TokenValue } from "@beanstalk/sdk";
import React, { useState } from "react";
import { useTokens } from "src/utils/TokenProvider";
import styled from "styled-components";
import { ArrowButton } from "./ArrowButton";
import gear from "src/assets/images/gear.svg";
import { TokenInput } from "./TokenInput";
import { Image } from "../Image";

export const SwapRoot = () => {
  const [inAmount, setInAmount] = useState(TokenValue.fromHuman("3.14", 6));
  // const [outAmount, setOutAmount] = useState(TokenValue.fromHuman("0", 18));
  const tokens = useTokens();
  const arrowHandler = () => console.log("Arrow");

  const inToken = tokens["BEAN"];
  const onInputChange = (a: TokenValue) => setInAmount(a);

  const outToken = tokens["WETH"];

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
          <TokenInput token={inToken} amount={inAmount} onAmountChange={onInputChange} canChangeToken={true} />
        </SwapInputContainer>
        <ArrowContainer>
          <ArrowButton onClick={arrowHandler} />
        </ArrowContainer>

        <SwapInputContainer>
          <TokenInput token={outToken}  canChangeToken={false} showBalance={false} allowNegative={true} />
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
