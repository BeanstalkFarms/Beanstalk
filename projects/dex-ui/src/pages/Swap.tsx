import React from "react";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import SwapLoading from "src/components/Swap/SwapLoading";
import { SwapRoot } from "src/components/Swap/SwapRoot";
import { useWellTokens } from "src/tokens/useWellTokens";

/**
 * Normally we would not check the loading state at this level, but
 * if we don't it'll cause errors in the SwapRoot component & it's children.
 * It's simpler to render a separate loading component here instead of handling it
 * everywhere else.
 */

export const Swap = () => {
  const { isLoading } = useWellTokens();

  return (
    <Page>
      <Title title="Swap" fontWeight={"600"} largeOnMobile />
      {isLoading ? <SwapLoading /> : <SwapRoot />}
    </Page>
  );
};
