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

  const base = getValue("");
  const x = getValue("x");
  const y = getValue("y");
  const top = getValue("t");
  const right = getValue("r");
  const bottom = getValue("b");
  const left = getValue("l");

  let baseArr: number[] = [];

  if (exists(base)) {
    baseArr = [base, base];
  }

  if (exists(y)) {
    if (baseArr.length === 2) {
      baseArr[0] = baseArr[0] + y;
    } else {
      baseArr.push(y);
    }
  }

  if (exists(x)) {
    if (baseArr.length === 2) {
      baseArr[1] = baseArr[1] + x;
    } else if (baseArr.length === 1) {
      baseArr.push(x);
    } else {
      baseArr = [0, x];
    }
  }

  if (baseArr[0] === baseArr[1]) baseArr.pop();

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
