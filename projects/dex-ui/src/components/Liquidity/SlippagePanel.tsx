/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from "react";
import styled from "styled-components";

import arrowLeft from "/src/assets/images/arrow.svg";

type SlippagePanelProps = {
  slippageValue: number;
  slippageValueChanged: (value: string) => void;
  closeModal: () => void;
};

const SlippagePanel = ({ slippageValueChanged, closeModal, slippageValue }: SlippagePanelProps) => {
  return (
    <SlippageContainer>
      <SlippageHeader>
        <SlippageImageSpacer>
          <img src={arrowLeft} alt="Back" onClick={closeModal} />
        </SlippageImageSpacer>
        <SlippageHeaderText>Adjust Slippage</SlippageHeaderText>
      </SlippageHeader>
      <SlippageBody>
        <SlippageTopSection>
          {/* // TODO: Can we show Slippage Tolerance as a "placeholder" (per design) */}
          {/* // TODO: Also, we need to show a trailing % */}
          <StyledInput type="text" defaultValue={slippageValue} onChange={(e) => slippageValueChanged(e.target.value)} />
          Slippage tolerance is the % change in token price caused by external factors between transaction submission and execution that you
          are willing to tolerate.
        </SlippageTopSection>
        <SlippageTextBottom>
          <p>Your transaction will revert if the price changes by more than the percentage specified.</p>
        </SlippageTextBottom>
      </SlippageBody>
    </SlippageContainer>
  );
};

const StyledInput = styled.input`
  // TODO: Make it look nice
`;

const SlippageTextBottom = styled.div`
  // TODO: Why doesn't this go to the bottom?
  display: flex;
  flex-direction: column;
  align-self: flex-end;
`;

const SlippageTopSection = styled.div`
  display: flex;
  flex-direction: column;
`;

const SlippageBody = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const SlippageHeaderText = styled.div`
  // TODO: style?
  font-weight: bold;
`;

const SlippageImageSpacer = styled.div`
  // TODO:
`;

const SlippageHeader = styled.div`
  display: flex;
  flex-direction: row;
`;

const SlippageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 500px;
`;

export default SlippagePanel;
