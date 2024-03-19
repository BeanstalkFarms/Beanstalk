import React, { useEffect } from "react";
import styled from "styled-components";
import { ConnectKitButton, useModal as useConnectKitModal } from "connectkit";
import { Button } from "src/components/Swap/Button";
import { useAccount } from "wagmi";

type ActionWalletButtonProps = { children: JSX.Element };

export const WalletButton = () => {
  useUpdateWalletModalStyles();

  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, truncatedAddress, ensName }) => {
        return (
          <>
            <StyledConnectButton onClick={show}>{isConnected ? ensName ?? truncatedAddress : "Connect Wallet"}</StyledConnectButton>
          </>
        );
      }}
    </ConnectKitButton.Custom>
  );
};

export const ActionWalletButtonWrapper = ({ children }: ActionWalletButtonProps) => {
  const { address } = useAccount();
  useUpdateWalletModalStyles();

  return !address ? (
    <ConnectKitButton.Custom>
      {({ show }) => {
        return <Button onClick={show} label="Connect Wallet" />;
      }}
    </ConnectKitButton.Custom>
  ) : (
    children
  );
};

const StyledConnectButton = styled.button`
  display: flex;
  direction: row;
  flex: 1;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  border: 1px dotted red;
  cursor: pointer;
  border: 0px;
  color: #000;
  background: #fff;
  :hover {
    background-color: #f0fdf4;
  }
`;

/**
 * When the ConnectKit modal is open & no address is connected,
 * this hook listens to mutations to the document body & searches for the ConnectKit modal.
 *
 * If the ConnectKit modal is found & the user selects the WalletConnect option,
 * the ConnectKit modal's z-index is set to 1.
 *
 * This is to prevent the WalletConnect modal from rendering behind the Connectkit modal
 * on render.
 */
const useUpdateWalletModalStyles = () => {
  const { address } = useAccount();
  const { open, setOpen } = useConnectKitModal();

  useEffect(() => {
    if (address || !open) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.innerText !== "Other Wallets") return;
      const els = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const el: any = Array.from(els).find((e) => e.className.includes("ModalContainer"));

      if (el) {
        el.style.zIndex = 1;
      }
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (!mutation.addedNodes) return;
        const modal = document.getElementById("__CONNECTKIT__");
        if (!modal) return;

        modal.addEventListener("click", handleClick);

        return () => {
          modal.removeEventListener("click", handleClick);
        };
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Clean up observer on unmount
    return () => {
      observer.disconnect();
    };
  }, [address, open, setOpen]);
};
