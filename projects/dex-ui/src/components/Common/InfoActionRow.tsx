import React from "react";
import styled from "styled-components";
import { FontVariant, getFontVariantStyles, Text } from "../Typography";
import { theme } from "src/utils/ui";

export interface IInfoActionRow {
  label: string;
  buttonLabel: string | JSX.Element;
  subLabel?: string;
  onClick: () => void;

  labelVariant?: FontVariant;
  subLabelVariant?: FontVariant;
}

export const InfoActionRow = ({ label, subLabel, buttonLabel, labelVariant = "l", subLabelVariant, onClick }: IInfoActionRow) => {
  return (
    <Container>
      <Labels>
        <Text variant={labelVariant}>{label}</Text>
        {subLabel ? <Text variant={subLabelVariant}>{subLabel}</Text> : null}
      </Labels>
      <Button onClick={onClick}>{buttonLabel}</Button>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: ${theme.colors.white};
  width: 100%;
  border: 0.25px solid ${theme.colors.gray};
  padding: ${theme.spacing(2, 3)};
  box-sizing: border-box;
`;

const Labels = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const Button = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${theme.spacing(1.5)};
  background: ${theme.colors.black};
  outline: 0.5px solid ${theme.colors.black};
  color: ${theme.colors.white};
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
  ${getFontVariantStyles("button-link")}

  :hover {
    outline: 2px solid ${theme.colors.primary};
  }

  :focus {
    outline: 2px solid ${theme.colors.primary};
  }
`;
