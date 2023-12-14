import React from "react";
import { ConnectKitButton } from "connectkit";
import { Button } from "src/components/Swap/Button";
import { useAccount } from "wagmi";

type ActionWalletButtonProps = { children: JSX.Element };

export const ActionWalletButtonWrapper = ({ children }: ActionWalletButtonProps) => {
  const { address } = useAccount();

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
