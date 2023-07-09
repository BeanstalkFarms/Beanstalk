import React, { Children, useCallback, useState, MouseEvent as ReactMouseEvent } from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { BodyCaps, BodyS, BodyXS } from "./Typography";
import { ImageButton } from "./ImageButton";
import { ChevronDown } from "./Icons";

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
  open?: boolean;
};
export const ExpandBox: FC<Props> & Composition = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [header, body] = Children.toArray(children);
  if (!header || !body) throw new Error("ExpandBox must have two children, Header and Boxy");

  const toggle = useCallback(
    (e: ReactMouseEvent) => {
      (e.target as HTMLElement).blur();
      setOpen(!open);
    },
    [open]
  );

  return (
    <Container open={open} onClick={toggle} data-trace="true">
      <Header id="header" open={open}>
        {header}
        <ImageButton
          component={ChevronDown}
          size={12}
          rotate={open ? "180" : "0"}
          onClick={toggle}
          padding="0px"
          alt="Click to expand this box and learn how to earn yield"
        />
      </Header>

      {open && body}
    </Container>
  );
};

const Container = styled.div<Props>`
  display: flex;
  flex-direction: column;
  border-top: 0.5px solid #9ca3af;
  border-left: 0.5px solid #9ca3af;
  border-right: 0.5px solid #9ca3af;
  border-bottom: ${(p) => (p.open ? "0.5px" : "0px")} solid #9caeaf;
  cursor: pointer;
  :hover {
    border-top: 0.5px solid #46b955;
    border-left: 0.5px solid #46b955;
    border-right: 0.5px solid #46b955;
    border-bottom: ${(p) => (p.open ? "0.5px" : "0px")} solid #46b955;
    outline: 0.5px solid #46b955;
  }
`;
const Header = styled.div<Props>`
  background-color: #f9f8f6;
  border-bottom: 0.5px solid #9ca3af;
  display: flex;
  flex-direction: row;
  padding: 12px 16px;
  justify-content: space-between;
  align-items: center;
  :hover {
    border-bottom: 0.5px solid ${(p) => (!p.open ? "#46b955" : "#9ca3af")};
  }

  @media (max-width: 475px) {
    padding: 8px;
  }
`;
const Body = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #fff;
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

const UserHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  ${BodyXS}
  text-transform: uppercase;

  @media (min-width: 475px) {
    ${BodyCaps}
  }
`;

ExpandBox.Header = UserHeader;
ExpandBox.Body = Body;
ExpandBox.Footer = Footer;
ExpandBox.Row = Row;
ExpandBox.Key = Key;
ExpandBox.Value = Value;
