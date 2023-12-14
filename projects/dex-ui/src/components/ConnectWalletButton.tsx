import { ConnectKitButton } from "connectkit";
import React, { ComponentProps } from "react";
import { Button } from "src/components/Swap/Button";
import { useAccount } from "wagmi";

type ActionWalletButtonProps = ComponentProps<typeof Button>;

export const ActionWalletButton = (props: ActionWalletButtonProps) => {
  const { address } = useAccount();

  return !address ? (
    <ConnectKitButton.Custom>
      {({ show }) => {
        return <Button onClick={show} label="Connect Wallet" />;
      }}
    </ConnectKitButton.Custom>
  ) : (
    <Button {...props} />
  );
};
