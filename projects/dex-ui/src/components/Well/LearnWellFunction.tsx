import React from "react";
import styled from "styled-components";
import { ExpandBox } from "src/components/ExpandBox";
import { TextNudge } from "../Typography";
import { FC } from "src/types";
import { WellFunction } from "../Icons";

type Props = {
  name: string;
};

function WellFunctionDetails(functionName: any) {
  if (functionName.functionName === "Constant Product") {
    return (
      <TextContainer>
        <div>
          A Well Function is a pricing function for determining how many tokens users receive for swaps, how 
          many LP tokens a user receives for adding liquidity, etc.
        </div>
        <div>
          <FunctionNameStyled>Constant Product</FunctionNameStyled> is a reusable pricing function which prices tokens using:
        </div>
        <div>
          <Bold>x * y = k</Bold>, where <Bold>x</Bold> is the amount of one token, <Bold>y</Bold> is the amount of the other and{" "}
          <Bold>k</Bold> is a fixed constant.
        </div>
      </TextContainer>
    );
  } else if (functionName.functionName === "Constant Product 2") {
    return (
      <TextContainer>
        <div>
          A Well Function is a pricing function for determining how many tokens users receive for swaps, how 
          many LP tokens a user receives for adding liquidity, etc.
        </div>
        <div>
          The BEAN:WETH Well uses the Constant Product 2 Well Function, which is a gas-efficient pricing function 
          for Wells with 2 tokens.
        </div>
      </TextContainer>
    );
  } else {
    return (
      <TextContainer>
        <div>{"Each Well utilizes a unique pricing function to price the tokens in the Well."}</div>
        <div>{"Brief descriptions of a Well's pricing function will appear in this box."}</div>
      </TextContainer>
    );
  }
}

export const LearnWellFunction: FC<Props> = ({ name }) => {
  return (
    <ExpandBox drawerHeaderText={`What is ${name}?`}>
      <ExpandBox.Header>
        <WellFunction />
        <TextNudge amount={1}>What is {name}?</TextNudge>
      </ExpandBox.Header>
      <ExpandBox.Body>
        <WellFunctionDetails functionName={name} />
      </ExpandBox.Body>
    </ExpandBox>
  );
};

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: #4b5563;
`;

const FunctionNameStyled = styled.span`
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 1px;
`;

const Bold = styled.span`
  font-weight: 600;
`;
