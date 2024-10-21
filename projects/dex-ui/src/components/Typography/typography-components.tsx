import styled, { css } from "styled-components";

import { size } from "src/breakpoints";
import { theme } from "src/utils/ui/theme";

export type ResponsiveTextProps = {
  $responsive?: boolean;
};

const BaseH1 = css`
  font-style: normal;
  font-weight: 400;
  font-size: 48px;
  line-height: 56px;
`;
const BaseH2 = css`
  font-style: normal;
  font-size: 32px;
  font-weight: 600;
  line-height: 40px;
`;
const BaseH3 = css`
  font-style: normal;
  font-weight: 600;
  font-size: 24px;
  line-height: 32px;
`;
const ResponsiveH3 = css`
  font-style: normal;
  font-weight: 600;
  font-size: 20px;
  line-height: 24px;
`;
const ResponsiveBodyL = css`
  font-style: normal;
  font-weight: 400;
  font-size: 18px;
  line-height: 24px;
`;

export const H1 = css<ResponsiveTextProps>`
  ${BaseH1}
  ${(p) => p.$responsive && ` ${theme.media.query.sm.only} { ${BaseH2} } `}
`;

export const H2 = css<ResponsiveTextProps>`
  ${BaseH2};
  ${(p) => p.$responsive && ` ${theme.media.query.sm.only} { ${BaseH3} } `}
`;

export const H3 = css<ResponsiveTextProps>`
  ${BaseH3}
  ${(p) => p.$responsive && `${theme.media.query.sm.only} { ${ResponsiveH3} } `}
`;

// don't change the font-size for BodyS & BodyXS
export const BodyXS = css<ResponsiveTextProps>`
  font-style: normal;
  font-weight: 400;
  font-size: 14px;
  line-height: 22px;
`;
export const BodyS = css<ResponsiveTextProps>`
  font-style: normal;
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
`;

export const BodyL = css<ResponsiveTextProps>`
  font-style: normal;
  font-weight: 400;
  font-size: 20px;
  line-height: 24px;
  ${(p) => p.$responsive && ` ${theme.media.query.sm.only} { ${ResponsiveBodyL} }`}
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
