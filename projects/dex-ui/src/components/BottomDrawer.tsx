import React from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { BodyXS } from "./Typography";
import x from "src/assets/images/x.svg";
import { ImageButton } from "./ImageButton";

interface Composition {
  Header: typeof Header;
  Body: typeof Body;
  Footer: typeof Footer;
  Row: typeof Row;
  Key: typeof Key;
  Value: typeof Value;
}

type Props = {
  showDrawer: boolean;
  headerText?:
    | string
    | number
    | React.ReactElement<any, string | React.JSXElementConstructor<any>>
    | React.ReactFragment
    | React.ReactPortal;
  toggleDrawer?: (isDrawerOpen: boolean) => void;
};

export const BottomDrawer: FC<Props> & Composition = ({ children, showDrawer, headerText, toggleDrawer }) => {
  return (
    <>
      <Container showDrawer={showDrawer} data-trace="true">
        <Header>
          {headerText}
          <ImageButton src={x} alt="Close drawer" size={10} onClick={() => toggleDrawer!(false)} />
        </Header>
        {children}
      </Container>
      <Background showDrawer={showDrawer} onClick={() => toggleDrawer!(false)} />
    </>
  );
};

const Background = styled.div<Props>`
  position: fixed;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.65);
  z-index: 9995;
  transition: all 0.3s ease-in-out;
  opacity: ${({ showDrawer }) => (showDrawer ? "1" : "0")};
  display: ${({ showDrawer }) => (showDrawer ? "flex" : "none")};
`;

const Container = styled.div<Props>`
  display: flex;
  flex-direction: column;
  position: fixed;
  width: 100vw;
  left: 0;
  transition: all 0.3s ease-in-out;
  bottom: ${({ showDrawer }) => (showDrawer ? "0" : "-100%")};
  outline: 0.5px solid #9ca3af;
  outline-offset: -0.5px;
  z-index: 9996;
  @media (min-width: 475px) {
    display: none;
  }
`;
const Header = styled.div`
  background-color: #f9f8f6;
  border-bottom: 0.5px solid #9ca3af;
  display: flex;
  flex-direction: row;
  padding: 8px 12px;
  justify-content: space-between;
`;
const Body = styled.div`
  display: flex;
  ${BodyXS}
  flex-direction: column;
  background-color: #fff;
  flex: 2;
  padding: 12px 12px;
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
  ${BodyXS}
`;
const Key = styled.div`
  color: #4b5563;
`;
const Value = styled.div`
  display: flex;
  flex: 2;
  justify-content: flex-end;
`;

BottomDrawer.Header = Header;
BottomDrawer.Body = Body;
BottomDrawer.Footer = Footer;
BottomDrawer.Row = Row;
BottomDrawer.Key = Key;
BottomDrawer.Value = Value;
