import React from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { BodyS } from "./Typography";

interface Composition {
  Header: typeof Header;
  Body: typeof Body;
  Footer: typeof Footer;
  Row: typeof Row;
  Key: typeof Key;
  Value: typeof Value;
}

type Props = {
  width?: number;
};
export const InfoBox: FC<Props> & Composition = ({ width = 432, children }) => {
  return (
    <Container width={width} data-trace="true">
      {children}
    </Container>
  );
};

const Container = styled.div<Props>`
  display: flex;
  flex-direction: column;
  outline: 0.5px solid #9ca3af;
  outline-offset: -0.5px;
  width: ${(p) => p.width}px;
  min-width: ${(p) => p.width}px;
`;
const Header = styled.div`
  background-color: #f9f8f6;
  border-bottom: 0.5px solid #9ca3af;
  display: flex;
  flex-direction: row;
  padding: 12px 16px;
  justify-content: space-between;
`;
const Body = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #fff;
  flex: 2;
  padding: 20px 16px;
  gap: 8px;
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
