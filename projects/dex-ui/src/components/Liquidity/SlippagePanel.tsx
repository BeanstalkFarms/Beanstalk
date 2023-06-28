/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { MouseEvent, useCallback, useState } from "react";
import styled from "styled-components";
import gearIcon from "/src/assets/images/gear.svg";
import x from "src/assets/images/x.svg";
import { ImageButton } from "../ImageButton";

type SlippagePanelProps = {
  slippageValue: number;
  handleSlippageValueChange: (value: string) => void;
  connectorFor?: string;
};

const SlippagePanel = ({ handleSlippageValueChange, slippageValue }: SlippagePanelProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const dontStealFocus = useCallback(
    (e: MouseEvent) => {
      if ((e.target as HTMLElement).id === "modal") {
        closeModal();
      }
    },
    [closeModal]
  );

  return (
    <Slippage>
      <Icon src={gearIcon} onClick={() => setModalOpen(!modalOpen)} modalOpen={modalOpen} />
      {modalOpen && (
        <>
          <Modal onMouseDown={dontStealFocus} id="modal" />
          <ModalContainer data-trace="true" onMouseDown={dontStealFocus}>
            <ModalHeader>
              <div id="dialog-title">Adjust Slippage</div>
              <ImageButton src={x} alt="Close token selector modal" size={10} onClick={closeModal} />
            </ModalHeader>
            <ModalContent>
              <InputContainer>
                <StyledInput type="text" defaultValue={slippageValue} onChange={(e) => handleSlippageValueChange(e.target.value)} />
                <InputAdornment>Slippage Amount</InputAdornment>
              </InputContainer>
              Slippage tolerance is the % change in token price caused by external factors between transaction submission and execution that
              you are willing to tolerate.
              <SlippageTextBottom>
                Your transaction will revert if the price changes by more than the percentage specified.
              </SlippageTextBottom>
            </ModalContent>
          </ModalContainer>
        </>
      )}
    </Slippage>
  );
};

const Slippage = styled.div``;

const StyledInput = styled.input`
  border: none;
  outline: none;
`;

const InputContainer = styled.div`
  height: 40px;
  border: 0.5px solid #3e404b;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  padding-left: 12px;
  padding-right: 12px;
  margin-bottom: 8px;
  &:focus-within {
    border: 0.5px solid #46b955;
  }
`;
const InputAdornment = styled.div``;

type GearIconProps = {
  modalOpen?: boolean;
};

const Icon = styled.img<GearIconProps>`
  margin-left: 10px;
  transition: 0.1s;
  vertical-align: text-bottom;
  rotate: ${(props) => (props.modalOpen ? `30deg` : `0deg`)};
  cursor: pointer;
  filter: ${(props) => (props.modalOpen ? `brightness(0%)` : `brightness(100%)`)};
  &:hover {
    filter: ${(props) => (props.modalOpen ? `brightness(0%)` : `brightness(50%)`)};
  }
`;

const SlippageTextBottom = styled.div`
  margin-top: 24px;
`;

const Modal = styled.div`
  position: fixed;
  top: 112px;
  left: 0px;
  bottom: 72px;
  right: 0px;
  background: rgba(0, 0, 0, 0.5);
  cursor: auto;
  display: flex;
  z-index: 900;
`;

const ModalContainer = styled.div`
  display: flex;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  align-self: flex-start;
  flex-direction: column;
  width: 408px;
  overflow: hidden;
  color: #000;
  z-index: 999;
  border: 2px solid black;
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
  border-bottom: 0.5px solid #3e404b;
  font-weight: 500;
  font-size: 16px;
`;

const ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  background: #fff;
  min-height: calc(3 * 48px);

  // 64px nav, 48px token bar, 96px four rows of margin, 72px footer,
  // 48px "Select token" header, 48px for the min gap at the bottom
  max-height: calc(100vh - 64px - 48px - 96px - 72px - 48px - 48px);
  overflow-y: auto;
  overflow-x: hidden;

  padding: 16px;
`;

export default SlippagePanel;
