import type { CSSProperties } from "react";
import { css } from "styled-components";

export type DisplayStyleProps = {
  $display?: CSSProperties["display"];
};

export const BlockDisplayStyle = css<DisplayStyleProps>`
  ${({ $display }) => ($display ? `display: ${$display};` : "")}
`;
