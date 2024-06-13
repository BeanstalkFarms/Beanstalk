/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { MouseEvent, useCallback } from "react";
import styled from "styled-components";
import x from "src/assets/images/x.svg";
import { ImageButton } from "./ImageButton";
import { theme } from "src/utils/ui/theme";

export const Dialog = ({
  open,
  id,
  children,
  header,
  // divider,
  canClose = true,
  closeModal
  // zIndex
}: {
  open: boolean;
  id: string; // unique id for the modal
  children: React.ReactNode;
  divider?: boolean;
  header?: string | React.ReactNode;
  canClose?: boolean;
  closeModal: () => void;
}) => {
  const dontStealFocus = useCallback(
    (e: MouseEvent) => {
      if (!canClose) return;
      if ((e.target as HTMLElement).id === id) {
        closeModal();
      }
    },
    [id, canClose, closeModal]
  );

  if (!open) return null;

  return (
    <div>
      <Container onMouseDown={dontStealFocus} id={id} />
      <DialogContainer data-trace="true" onMouseDown={dontStealFocus}>
        {header ? (
          <DialogHeader>
            {header}
            {canClose && (
              <ImageButton
                src={x}
                alt="Close token selector modal"
                size={10}
                onClick={closeModal}
              />
            )}
          </DialogHeader>
        ) : null}
        <Content>{children}</Content>
      </DialogContainer>
    </div>
  );
};

const Container = styled.div`
  position: fixed;
  top: 112px;
  left: 0px;
  bottom: 72px;
  right: 0px;
  background: rgba(0, 0, 0, 0.5);
  cursor: auto;
  display: flex;
  z-index: 901;

  ${theme.media.query.sm.only} {
    top: 56px;
    bottom: 0px;
  }
`;

const DialogHeader = styled.div<{ $divider?: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: 16px;
  height: 48px;
  background: #fff;
  border-bottom: ${(p) => (p.$divider ? "0.5px solid #3e404b" : "none")};
  font-weight: 500;
  font-size: 16px;
`;

const DialogContainer = styled.div`
  display: flex;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  align-self: flex-start;
  flex-direction: column;
  overflow: hidden;
  color: #000;
  z-index: 999;
  border: 2px solid black;

  ${theme.media.query.sm.only} {
    max-width: calc(100% - ${theme.spacing(4)});
    width: 100%;
  }
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  background: #fff;
  min-height: calc(3 * 48px);

  // 64px nav, 48px token bar, 96px four rows of margin, 72px footer,
  // 48px "Select token" header, 48px for the min gap at the bottom
  max-height: calc(100vh - 64px - 48px - 96px - 72px - 48px - 48px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${theme.spacing(2)};
`;
