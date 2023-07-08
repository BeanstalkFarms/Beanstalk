import styled from "styled-components";

export const Item = styled.div<{ stretch?: boolean; right?: boolean; column?: boolean }>`
  display: flex;
  ${({ column }) => column && "flex-direction: column;"}
  ${({ stretch }) => stretch && "flex: 2;"}
  ${({ right, column }) => right && (column ? "align-items: end;" : "justify-content: right;")}
`;

export const Row = styled.div<{ gap?: number, mobileGap?: string }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  ${({ gap }) => gap && `gap: ${gap}px;`}

  @media (max-width: 475px) {
    ${({ gap, mobileGap }) => mobileGap ? `gap: ${mobileGap};` : `gap: ${gap}px;`}
  }
`;
