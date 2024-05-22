import styled, { css } from "styled-components";
import { size } from "src/breakpoints";
import { FontVariant } from "src/utils/ui/theme";

export const H1 = css`
  font-style: normal;
  font-weight: 400;
  font-size: 48px;
  line-height: 56px;
`;

export const H2 = css`
  font-style: normal;
  font-size: 32px;
  font-weight: 600;
  line-height: 40px;
`;

export const H3 = css`
  font-style: normal;
  font-weight: 600;
  font-size: 24px;
  line-height: 32px;
`;

export const BodyXS = css`
  font-style: normal;
  font-weight: 400;
  font-size: 14px;
  line-height: 22px;
`;
export const BodyS = css`
  font-style: normal;
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
`;
export const BodyL = css`
  font-style: normal;
  font-weight: 400;
  font-size: 20px;
  line-height: 24px;
`;
export const LinksCaps = css`
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0.06em;
  text-decoration-line: underline;
  text-transform: uppercase;
`;
export const BodyCaps = css`
  font-style: normal;
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
export const LinksNav = css`
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
export const LinksButtonText = css`
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0.02em;
`;
export const LinksTextLink = css`
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  /* identical to box height, or 150% */

  letter-spacing: 0.02em;
  text-decoration-line: underline;
`;

export const PageTitle = styled.h1`
  font-style: normal;
  font-weight: 400;
  font-size: 48px;
  line-height: 56px;
  margin: 0px;
  padding: 0px;
  text-transform: uppercase;
`;

// Helps nudge text to work around the font's
// messed up baseline, when we want the text
// to be vertically centered.
type NudgeProps = { amount: number; mobileAmount?: number };
export const TextNudge = styled.div<NudgeProps>`
  margin-top: ${({ amount }) => amount}px;
  margin-bottom: ${({ amount }) => -1 * amount}px;
  @media (max-width: ${size.mobile}) {
    margin-top: ${(props) => props.mobileAmount || props.amount}px;
    margin-bottom: ${(props) => -1 * (props.mobileAmount || props.amount)}px;
  }
`;

export const getFontVariantStyles = (variant: FontVariant) => {
  switch (variant) {
    case "h1":
      return H1;
    case "h2":
      return H2;
    case "h3":
      return H3;
    case "l":
      return BodyL;
    case "s":
      return BodyS;
    case "xs":
      return BodyXS;
    case "button-link":
      return LinksButtonText;
    default:
      return BodyS;
  }
};
