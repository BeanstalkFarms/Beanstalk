import { BoxModelBase, BoxModelProps } from "src/utils/ui/styled";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";

const ButtonBase = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  border: 0;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
  outline: 0.5px solid ${theme.colors.black};
  ${theme.font.styles.variant("button-link")}
`;

export const ButtonPrimary = styled(ButtonBase)<BoxModelProps>`
  background: ${theme.colors.black};
  color: ${theme.colors.white};
  padding: ${theme.spacing(1.5)};
  ${BoxModelBase}

  :hover {
    outline: 2px solid ${theme.colors.primary};
  }

  :focus {
    outline: 2px solid ${theme.colors.primary};
  }
`;
