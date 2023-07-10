import React from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { BodyS, BodyXS } from "./Typography";

interface Composition {
  Header: typeof Header;
  Body: typeof Body;
  Footer: typeof Footer;
  Row: typeof Row;
  Key: typeof Key;
  Value: typeof Value;
}

type Props = {
};
export const InfoBox: FC<Props> & Composition = ({ children }) => {
  return (
    <Container data-trace="true">
      {children}
    </Container>
  );
};

const Container = styled.div<Props>`
  display: flex;
  flex-direction: column;
  outline: 0.5px solid #9ca3af;
  outline-offset: -0.5px;
`;
const Header = styled.div`
  background-color: #f9f8f6;
  border-bottom: 0.5px solid #9ca3af;
  display: flex;
  flex-direction: row;
  padding: 12px 16px;
  justify-content: space-between;
  @media (max-width: 475px) {
    padding: 8px 12px;
  }
`;
const Body = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #fff;
  flex: 2;
  padding: 20px 16px;
  gap: 8px;
  @media (max-width: 475px) {
    padding: 12px 12px;
    ${BodyXS}
  }
`;
const Footer = styled.div`
  display: flex;
  flex-direction: row;
  padding: 12px 16px;
  background-color: #fff;
  border-top: 0.5px solid #9ca3af;
`;

const Row = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  ${BodyS}
  @media (max-width: 475px) {
    ${BodyXS}
  }
`;
const Key = styled.div`
  color: #4b5563;
`;
const Value = styled.div`
  display: flex;
  flex: 2;
  justify-content: flex-end;
`;

InfoBox.Header = Header;
InfoBox.Body = Body;
InfoBox.Footer = Footer;
InfoBox.Row = Row;
InfoBox.Key = Key;
InfoBox.Value = Value;
