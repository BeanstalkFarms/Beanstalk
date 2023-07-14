import { Token } from "@beanstalk/sdk";
import React, { useCallback, useEffect, useState } from "react";
import { FC } from "src/types";
import { useTokens } from "src/tokens/TokenProvider";
import styled, { keyframes } from "styled-components";
import { TokenLogo } from "src/components/TokenLogo";
import { Image } from "../Image";
import chevDown from "src/assets/images/chevron-down.svg";
import x from "src/assets/images/x.svg";
import { ImageButton } from "../ImageButton";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import { Spinner } from "../Spinner";
import { ChevronDown } from "../Icons";
import { BottomDrawer } from "../BottomDrawer";
import { BodyS } from "../Typography";

type Props = {
  token: Token;
  excludeToken?: Token;
  editable?: boolean;
  onChange?: (t: Token) => void;
  connectorFor?: string;
};

type ContainerProps = {
  editable?: Boolean;
};

export const TokenPicker: FC<Props> = ({ token, excludeToken, editable = true, onChange, connectorFor }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const tokens = useTokens();
  const [list, setList] = useState<Token[]>([]);
  const { data: balances, isLoading: balancesLoading, error: balancesError, refetch, isFetching } = useAllTokensBalance();

  useEffect(() => {
    let list = Object.values(tokens).filter((t: Token) => t.symbol !== excludeToken?.symbol);

    setList(list);
  }, [tokens, excludeToken]);

  const openModal = useCallback(() => {
    if (!editable) return;
    setModalOpen(true);
    refetch();
  }, [editable, refetch]);

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
            <TokenLogo token={token} size={16} />
            <TokenSymbol>{token.symbol}</TokenSymbol>
          </>
        ) : (
          <div>Select a Token</div>
        )}
        {editable && <ChevronDown width={8} color="#adadad" />}
      </Button>
      {modalOpen && (
        <DesktopModal id="modal-background" onClick={closeModal} role="dialog" aria-labelledby="dialog-title">
          <ModalContainer id="modal" data-trace="true">
            <ModalHeader>
              <div id="dialog-title">Select a token</div>
              <ImageButton src={x} alt="Close token selector modal" size={10} onClick={closeModal} />
            </ModalHeader>
            <ModalContent>
              <Ol>
                {list.map((token: Token) => (
                  <TokenRow key={token.symbol} onClick={() => selectToken(token)}>
                    <TokenLogo token={token} size={25} />
                    <Details>
                      <Symbol>{token.symbol}</Symbol>
                      <Name>{token.displayName}</Name>
                    </Details>
                    {balancesLoading || isFetching ? <Spinner size={14} /> : <Balance>{balances?.[token.symbol]?.toHuman()}</Balance>}
                  </TokenRow>
                ))}
              </Ol>
            </ModalContent>
          </ModalContainer>
          {connectorFor === "input-amount" && (
            <InConnector>
              <svg xmlns="http://www.w3.org/2000/svg" width={48} height={6} fill="none">
                <path id="line" stroke="#46B955" d="M0 3h47.5" />
                <path fill="#F9F8F6" stroke="#3E404B" d="M48.5 5.45a2.5 2.5 0 0 1 0-4.9v4.9Z" />
                <path fill="#F9F8F6" stroke="#46B955" d="M0 .55a2.5 2.5 0 0 1 0 4.9V.55Z" />
              </svg>
            </InConnector>
          )}
          {connectorFor === "output-amount" && (
            <OutConnector>
              <svg xmlns="http://www.w3.org/2000/svg" width={48} height={184} fill="none">
                <path id="line" stroke="#46B955" d="M-1 171H21a3 3 0 0 0 3-3V5a3 3 0 0 1 3-3h20.5" />
                <path fill="#F9F8F6" stroke="#3E404B" d="M48.5 5.45a2.5 2.5 0 0 1 0-4.9v4.9Z" />
                <path fill="#F9F8F6" stroke="#46B955" d="M0 167.55a2.502 2.502 0 0 1 0 4.9v-4.9Z" />
              </svg>
            </OutConnector>
          )}
        </DesktopModal>
      )}
      <MobileDrawer>
        <BottomDrawer showDrawer={modalOpen} headerText={"Select a token"} toggleDrawer={setModalOpen}>
          <ModalContent>
            <Ol>
              {list.map((token: Token) => (
                <TokenRow key={token.symbol} onClick={() => selectToken(token)}>
                  <TokenLogo token={token} size={25} />
                  <Details>
                    <Symbol>{token.symbol}</Symbol>
                    <Name>{token.displayName}</Name>
                  </Details>
                  {balancesLoading || isFetching ? <Spinner size={14} /> : <Balance>{balances?.[token.symbol]?.toHuman("short")}</Balance>}
                </TokenRow>
              ))}
            </Ol>
          </ModalContent>
        </BottomDrawer>
      </MobileDrawer>
    </>
  );
};

const InAnimation = keyframes`
  0% {stroke-dashoffset: 48px;}
  100% {stroke-dashoffset:0px;}
`;
const InConnector = styled.div`
  position: relative;
  top: 106px;
  left: -432px;
  > svg > #line {
    stroke-dasharray: 48px;
    stroke-dashoffset: 48px;
    animation: ${InAnimation} 0.5s cubic-bezier(0, 0.55, 0.45, 1) forwards;
  }
`;
const OutAnimation = keyframes`
  0% {stroke-dashoffset: 225;}
  100% {stroke-dashoffset:0px;}
`;
const OutConnector = styled.div`
  position: relative;
  top: 118px;
  left: -432px;

  > svg > #line {
    stroke-dasharray: 225px;
    stroke-dashoffset: 225px;
    animation: ${OutAnimation} 0.5s cubic-bezier(0, 0.55, 0.45, 1) forwards;
  }
`;

const TokenRow = styled.li`
  border-bottom: 0.5px solid #ccc;
  display: flex;
  align-items: center;
  padding: 0px 12px;
  cursor: pointer;
  height: 48px;

  :last-child {
    border-bottom: none;
  }

  :hover {
    background: rgba(70, 185, 85, 0.1);
    outline: 0.5px solid #46b955;
  }
`;
const Details = styled.div`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  padding-left: 8px;
`;
const Symbol = styled.div`
  font-weight: 400;
  font-size: 16px;
  line-height: 20px;
  @media (max-width: 475px) {
    line-height: 16px;   
  }
`;
const Name = styled.div`
  ont-weight: 400;
  font-size: 14px;
  line-height: 20px;
  color: #9e9e9e;
  @media (max-width: 475px) {
    line-height: 14px;   
  }
`;
const Balance = styled.div`
  font-weight: 500;
  font-size: 20px;
  line-height: 24px;
  max-width: 175px;
  text-overflow: ellipsis;
  overflow: hidden;
  @media (max-width: 475px) {
    ${BodyS}
  }
`;

const MobileDrawer = styled.div`
  @media (min-width: 475px) {
    display: none;
  }
`;

const DesktopModal = styled.div`
  position: fixed;
  top: 112px;
  left: 0px;
  bottom: 72px;
  right: 0;
  background: #00000000;
  cursor: auto;
  display: flex;
  z-index: 1024;
  @media (max-width: 475px) {
    display: none;
  }
`;
const ModalContainer = styled.div`
  display: flex;
  align-self: flex-start;
  flex-direction: column;
  margin-left: 480px;
  margin-top: 96px;
  width: 384px;
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
  padding: 12px;
  background: #fff;
  border: 1px solid #3e404b;
  font-weight: 500;
  font-size: 16px;
  line-height: 24px;
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

  @media (max-width: 475px) {
    max-height: calc(100vh - 56px);
    border-width: 0px 0px 0.5px 0px;
  }
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
  background: #ffffff;
  border: none;

  color: #000000;
  appearance: none;

  padding: 0px 5px;
  gap: 6px;
  cursor: ${(props) => (props.editable ? "pointer" : "auto")};
`;

const TokenSymbol = styled.div`
  font-style: normal;
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
  color: #4b5563;
  margin-top: 2px;
`;
