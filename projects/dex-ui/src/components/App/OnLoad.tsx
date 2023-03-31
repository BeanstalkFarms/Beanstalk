import React from "react";
import { useTokenBalance } from "src/tokens/useTokenBalance";
import { FC } from "src/types";

export const OnLoad: FC<{}> = ({ children }) => {
  useTokenBalance();

  return <>{children}</>;
};
