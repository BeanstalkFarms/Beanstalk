/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useCallback, useState } from "react";
import styled, { keyframes } from "styled-components";
import gearIcon from "/src/assets/images/gear.svg";
import x from "src/assets/images/x.svg";
import { ImageButton } from "../ImageButton";

type SlippagePanelProps = {
  slippageValue: number;
  handleSlippageValueChange: (value: string) => void;
  connectorFor?: string;
};

const SlippagePanel = ({ handleSlippageValueChange, connectorFor, slippageValue }: SlippagePanelProps) => {
  
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <Slippage>
      <Icon src={gearIcon} onClick={() => setModalOpen(!modalOpen)} modalOpen={modalOpen}/>
      {modalOpen && (
      <ModalContainer id="modal" data-trace="true">
        <ModalHeader>
          <div id="dialog-title">Adjust Slippage</div>
          <ImageButton src={x} alt="Close token selector modal" size={10} onClick={closeModal} />
        </ModalHeader>
        <ModalContent>
          <InputContainer>
            <StyledInput type="text" defaultValue={slippageValue} onChange={(e) => handleSlippageValueChange(e.target.value)} />
            <InputAdornment>Slippage Amount</InputAdornment>
          </InputContainer>
          Slippage tolerance is the % change in token price caused by external factors between transaction submission and execution that you
          are willing to tolerate.
          <SlippageTextBottom>
            Your transaction will revert if the price changes by more than the percentage specified.
          </SlippageTextBottom>
        </ModalContent>
      </ModalContainer>
      )}
      {connectorFor === "slippage" && modalOpen && (
      <InConnector>
        <svg xmlns="http://www.w3.org/2000/svg" width={48} height={80} fill="none">
          <path id="line" stroke="#46B955" d="M-1 75H21a3 3 0 0 0 3-3V5a3 3 0 0 1 3-3h20.5" />
          <path fill="#F9F8F6" stroke="#3E404B" d="M48.5 5.45a2.5 2.5 0 0 1 0-4.9v4.9Z" />
          <path fill="#F9F8F6" stroke="#46B955" d="M0 73a2.502 2.502 0 0 1 0 4.9v-4.9Z" />
        </svg>
      </InConnector>
      )}
    </Slippage>
  );
};

const Slippage = styled.div`
  position: relative;
`

const StyledInput = styled.input`
  border: none;
`;

const InputContainer = styled.div`
  height: 40px;
  border: 1px solid #3e404b;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  padding-left: 12px;
  padding-right: 12px;
  margin-bottom: 8px;
`
const InputAdornment = styled.div`  
`

type GearIconProps = {
  modalOpen?: boolean,
}

const Icon = styled.img<GearIconProps>`
  margin-left: 10px;
  transition: rotate 0.1s;
  rotate: ${(props) => props.modalOpen ? `30deg` : `0deg` }; 
`;

const SlippageTextBottom = styled.div`
  margin-top: 24px;
`;

const InAnimation = keyframes`
  0% {stroke-dashoffset: 124;}
  100% {stroke-dashoffset:0px;}
`;

const InConnector = styled.div`
  position: absolute;
  top: -68px;
  left: 26px;
  > svg > #line {
    stroke-dasharray: 124px;
    stroke-dashoffset: 124px;
    animation: ${InAnimation} 0.5s cubic-bezier(0, 0.55, 0.45, 1) forwards;
  }
`;

const ModalContainer = styled.div`
  position: absolute;
  top: -90px;
  left: 74px;
  background: #00000000;
  display: flex;
  align-self: flex-start;
  flex-direction: column;
  width: 408px;
  overflow: hidden;
  color: #000;
  z-index: 1000;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: 16px;
  height: 48px;
  background: #fff;
  border: 1px solid #3e404b;
  font-weight: 500;
  font-size: 16px;
`;

const ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  background: #fff;
  border-width: 0px 1px 1px 1px;
  border-style: solid;
  border-color: #3e404b;
  min-height: calc(3 * 48px);

  // 64px nav, 48px token bar, 96px four rows of margin, 72px footer,
  // 48px "Select token" header, 48px for the min gap at the bottom
  max-height: calc(100vh - 64px - 48px - 96px - 72px - 48px - 48px);
  overflow-y: auto;
  overflow-x: hidden;
  
  padding: 16px;
`;


export default SlippagePanel;
