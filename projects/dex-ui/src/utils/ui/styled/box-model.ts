import { css } from "styled-components";
import { theme } from "../theme";
import { exists } from "src/utils/check";

export type BoxModelProps = PaddingProps & MarginProps;

export type PaddingProps = {
  $p?: number;
  $px?: number;
  $py?: number;
  $pt?: number;
  $pr?: number;
  $pb?: number;
  $pl?: number;
};

export type MarginProps = {
  $m?: number;
  $mx?: number;
  $my?: number;
  $mt?: number;
  $mr?: number;
  $mb?: number;
  $ml?: number;
};

type BoxModelSuffix = "y" | "x" | "t" | "r" | "b" | "l" | "";
type BoxModelAlias = "padding" | "margin";

const emptyStyle = css``;

const makeBoxModelStyles = (_type: BoxModelAlias, props?: BoxModelProps) => {
  if (!props) return emptyStyle;

  const type = _type === "padding" ? "p" : "m";
  const getValue = (suffix: BoxModelSuffix) => (props || {})[`$${type}${suffix}`];

  const base = getValue("") ?? 0;
  const x = getValue("x") ?? 0;
  const y = getValue("y") ?? 0;
  const top = getValue("t");
  const right = getValue("r");
  const bottom = getValue("b");
  const left = getValue("l");

  let baseArr: number[] = base + y + x !== 0 ? [base + y, base + x] : [];

  return css`
    ${baseArr.length ? `${_type}: ${theme.spacing(...baseArr)};` : ""}
    ${exists(top) ? `${_type}-top: ${theme.spacing(top)};` : ""}
    ${exists(right) ? `${_type}-right: ${theme.spacing(right)};` : ""}
    ${exists(bottom) ? `${_type}-bottom: ${theme.spacing(bottom)};` : ""}
    ${exists(left) ? `${_type}-left: ${theme.spacing(left)};` : ""}
  `;
};

export const BoxModelBase = css<BoxModelProps>`
  ${(props) => makeBoxModelStyles("padding", props)}
  ${(props) => makeBoxModelStyles("margin", props)}
`;
