import React, { useCallback, useContext } from "react";

import * as Dialog from "@radix-ui/react-dialog";
import styled, { keyframes } from "styled-components";

import x from "src/assets/images/x.svg";
import { theme } from "src/utils/ui/theme";

import { ImageButton } from "./ImageButton";
import { Divider, Flex } from "./Layout";
import { Text, TextProps } from "./Typography";

type ModalContextProps = {
  open: boolean;
  allowClose?: boolean;
  wide?: boolean;
  onOpenChange: (value: boolean) => void;
};

export type ModalProps = {
  children: React.ReactNode;
} & ModalContextProps;

type EventPartial = {
  preventDefault: () => void;
};

const ModalContext = React.createContext<ModalContextProps | null>(null);

const useModalContext = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModalContext must be used within a ModalProvider");
  }
  return context;
};

const ModalProvider = ({ children, open, allowClose, wide, onOpenChange }: ModalProps) => {
  return (
    <ModalContext.Provider
      value={{
        open: open,
        allowClose: allowClose,
        wide: wide,
        onOpenChange: onOpenChange
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export function Modal({ children, open, wide, allowClose = true, onOpenChange }: ModalProps) {
  const closeWithCheck = useCallback(
    <T extends EventPartial>(e: T) => {
      if (!allowClose) {
        e.preventDefault();
        return;
      }
      onOpenChange(false);
    },
    [allowClose, onOpenChange]
  );

  return (
    <ModalProvider open={open} allowClose={allowClose} wide={wide} onOpenChange={onOpenChange}>
      <Dialog.Root modal open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <StyledOverlay />
          <StyledContent
            onPointerDownOutside={closeWithCheck}
            onInteractOutside={closeWithCheck}
            onEscapeKeyDown={closeWithCheck}
          >
            {children}
          </StyledContent>
        </Dialog.Portal>
      </Dialog.Root>
    </ModalProvider>
  );
}

const overlayShow = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const contentShow = keyframes`
  from {
      opacity: 0;
      transform: translate(-50%, -48%) scale(0.96);
  }
  to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
  }
`;
const CloseWrapper = styled.div`
  justify-self: flex-end;
`;

const StyledOverlay = styled(Dialog.Overlay)`
  background-color: rgba(0 0 0 / 0.5);
  position: fixed;
  inset: 0;
  animation: ${overlayShow} 150ms cubic-bezier(0.16, 1, 0.3, 1);
`;

const StyledContent = styled(Dialog.Content)`
  background-color: ${theme.colors.white};
  border-radius: 0px;
  box-shadow:
    hsl(206 22% 7% / 35%) 0px 10px 38px -10px,
    hsl(206 22% 7% / 20%) 0px 10px 20px -15px;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: ${contentShow} 150ms cubic-bezier(0.16, 1, 0.3, 1);

  &:focus {
    outline: none;
  }

  ${theme.media.query.sm.only} {
    max-width: calc(100vw - 48px);
  }
`;

const ModalTitle = ({ divider = false, ...props }: TextProps & { divider?: boolean }) => {
  const { open, allowClose, wide, onOpenChange } = useModalContext();

  return (
    <Flex $fullWidth>
      <Flex
        $direction="row"
        $justifyContent="space-between"
        $fullWidth
        $px={wide ? 4 : 2}
        $py={2}
        $boxSizing="border-box"
      >
        <Text $variant="s" $weight="semi-bold" {...props} />
        {allowClose && (
          <CloseWrapper>
            <ImageButton
              src={x}
              alt="Close token selector modal"
              size={10}
              onClick={() => onOpenChange(!open)}
            />
          </CloseWrapper>
        )}
      </Flex>
      {divider && (
        <Flex $fullWidth $mb={2}>
          <Divider />
        </Flex>
      )}
    </Flex>
  );
};

const ModalContent = ({ children, noTitle }: { children: React.ReactNode; noTitle?: boolean }) => {
  const { wide } = useModalContext();
  return (
    <ModalContentItem $wide={wide} $noTitle={noTitle}>
      {children}
    </ModalContentItem>
  );
};

const ModalContentItem = styled(Flex)<{ $wide?: boolean; $noTitle?: boolean }>`
  width: 100%;
  padding: ${(p) =>
    p.$wide
      ? theme.spacing(p.$noTitle ? 4 : 0, 4, 4, 4)
      : theme.spacing(p.$noTitle ? 2 : 0, 2, 2, 2)};
  box-sizing: border-box;
  ${theme.media.query.sm.only} {
    padding: ${theme.spacing(2, 2, 2, 2)};
  }
`;

Modal.Content = ModalContent;

Modal.Title = ModalTitle;
