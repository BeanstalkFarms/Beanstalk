import { Token } from "@beanstalk/sdk";
import React, { useCallback, useEffect, useState } from "react";
import { FC } from "src/types";
import { useTokens } from "src/utils/TokenProvider";
import styled from "styled-components";
import { TokenLogo } from "src/components/TokenLogo";
import { Image } from "../Image";
import chevDown from "src/assets/images/chevron-down.svg";
import x from "src/assets/images/x.svg";
import { ImageButton } from "../ImageButton";

type Props = {
  token: Token;
  excludeToken?: Token;
  editable?: boolean;
  onChange?: (t: Token) => void;
};

type ContainerProps = {
  editable?: Boolean;
};

export const TokenPicker: FC<Props> = ({ token, excludeToken, editable = true, onChange }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const tokens = useTokens();
  const [list, setList] = useState<Token[]>([]);

  useEffect(() => {
    let list = Object.values(tokens).filter((t: Token) => t.symbol !== excludeToken?.symbol);

    setList(list);
  }, [tokens, excludeToken]);

  const openModal = useCallback(() => editable && setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const selectToken = useCallback(
    (token: Token) => {
      closeModal();
      onChange?.(token);
    },
    [closeModal, onChange]
  );

  return (
    <>
      <Button editable={editable} onClick={openModal}>
        {token ? (
          <>
            <TokenLogo token={token} size={20} />
            <TokenSymbol>{token.symbol}</TokenSymbol>
          </>
        ) : (
          <div>Select a Token</div>
        )}
        {editable && <Image src={chevDown} alt={"Token Dropdown"} size={9} />}
      </Button>
      {modalOpen && (
        <>
          <Modal id="modal-background" onClick={closeModal} role="dialog" aria-labelledby="dialog-title">
            <ModalContainer id="modal">
              <ModalHeader>
                <div id="dialog-title">Select a token</div>
                <ImageButton src={x} alt="Close token selector modal" size={10} onClick={closeModal} />
              </ModalHeader>
              <ModalContent>
                <Ol>
                  {list.map((token: Token) => (
                    <TokenRow key={token.symbol} onClick={() => selectToken(token)}>
                      <TokenLogo token={token} size={40} />
                      <Details>
                        <Symbol>{token.symbol}</Symbol>
                        <Name>{token.displayName}</Name>
                      </Details>
                      <Balance>1234567890</Balance>
                    </TokenRow>
                  ))}
                </Ol>
              </ModalContent>
            </ModalContainer>
          </Modal>
        </>
      )}
    </>
  );
};

const TokenRow = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 24px;
  cursor: pointer;

  :hover {
    background: #2f3343;
  }
`;
const Details = styled.div`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
`;
const Symbol = styled.div`
  font-weight: 500;
  font-size: 18px;
  line-height: 24px;
`;
const Name = styled.div`
  ont-weight: 400;
  font-size: 14px;
  line-height: 17px;
  color: #9e9e9e;
`;
const Balance = styled.div`
  font-weight: 500;
  font-size: 20px;
  line-height: 26px;
  max-width: 175px;
  text-overflow: ellipsis;
  overflow: hidden;
`;

const Modal = styled.dialog`
  position: fixed;
  top: 0px;
  left: 0px;
  bottom: 0;
  right: 0;
  // backdrop-filter: blur(2px);
  background: #00000087;
  cursor: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1024;
`;
const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  background: none;
  width: 410px;
  max-height: 80vh;
  border-radius: 11px;
  overflow: hidden;
  font-family: "Inter";
  color: #ffffff;
  cursor: auto;
  z-index: 1000;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  background: #272a37;
  border: 1px solid #3e404b;
  border-radius: 12px 12px 0px 0px;
  font-weight: 600;
  font-size: 16px;
  line-height: 20px;
`;

const ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  background: #272a37;
  border-width: 0px 1px 1px 1px;
  border-style: solid;
  border-color: #3e404b;
  border-radius: 0px 0px 12px 12px;
  flex: 1;
  // padding: 12px;
  overflow-y: auto;
  overflow-x: hidden;
`;

const Ol = styled.ol`
  margin: 0px;
  padding: 0px;
`;

const Button = styled.button<ContainerProps>`
  display: flex;
  flex-direction: row nowrap;
  align-items: center;
  align-self: end;
  white-space: nowrap;
  height: 40px;
  background: #2f3242;
  border: none;
  border-radius: 12px;
  color: white;
  appearance: none;

  padding: 4px 10px;
  gap: 6px;
  cursor: ${(props) => (props.editable ? "pointer" : "auto")};
`;

const TokenSymbol = styled.div`
  font-family: "Inter";
  font-style: normal;
  font-weight: 600;
  font-size: 18px;
  line-height: 24px;
`;
