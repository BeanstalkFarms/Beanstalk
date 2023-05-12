import React from "react";
import { Page } from "src/components/Frame/assets/Page";
import { Title } from "src/components/PageComponents/Title";
import { SwapRoot } from "src/components/Swap/SwapRoot";

export const Swap = () => {
  return (
    <Page>
      <Title title="Swap" />
      <SwapRoot />
    </Page>
  );
};
