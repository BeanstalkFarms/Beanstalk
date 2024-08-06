import { css } from "styled-components";
import { CssProps } from "../theme";

export const AdditionalCssBase = css<CssProps>`
  ${(props) => (props.$css ? props.$css : "")}
`;
