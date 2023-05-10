import React from "react";
import { Link } from "react-router-dom";
import { FC } from "src/types";
import styled from "styled-components";
import { ConnectKitButton } from "connectkit";
import { useNetwork } from "wagmi";
import grid from "src/assets/images/grid.svg";
import { Footer } from "./Footer";

export const Frame: FC<{}> = ({ children }) => {
  const { chain } = useNetwork();
  let net;
  switch (chain?.name) {
    case "localhost:8545":
      net = "DEV";
      break;
    case "Ethereum":
      net = "ETH";
      break;
    default:
      net = "X";
  }

  return (
    <Container id="frame">
      <NavContainer>
        <Brand>
          <strong>[BASIN]</strong>
        </Brand>
        <RightSide>
          <NavLinks>
            <NavLink to="/wells">Liquidity</NavLink>
            <NavLink to="/build">Build</NavLink>
            <NavLink to="/swap">Swap</NavLink>
          </NavLinks>
          {/* {net} */}
          <ConnectionContainer>
            <ConnectKitButton />
          </ConnectionContainer>
        </RightSide>
      </NavContainer>
      <TokenMarquee />
      <ContentContainer>{children}</ContentContainer>
      <Footer />
    </Container>
  );
};

const TokenMarquee = styled.div`
  display: flex;
  height: 48px;
  box-sizing: border-box;
  border-left: 0.5px solid black;
  border-right: 0.5px solid black;
  border-bottom: 0.25px solid black;
  width: 100vw;
`;

const Container = styled.div`
  // border: 1px solid red;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  align-items: center;
`;

const NavContainer = styled.nav`
  border: 0.5px solid black;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100vw;
  height: 64px;
  box-sizing: border-box;
  padding: 0px 48px;
  align-items: center;
`;

const NavLinks = styled.div`
  display: flex;
  align-self: stretch;
  align-items: center;
`;
const NavLink = styled(Link)`
  border-left: 0.5px solid black;
  box-sizing: border-box;
  display: flex;
  width: 192px;
  align-self: stretch;
  align-items: center;
  justify-content: center;

  text-decoration: none;
  text-transform: uppercase;
  font-weight: 700;
  color: black;
  outline: none !important;

  :focus {
    outline: none !important;
  }
`;
const RightSide = styled.div`
  // border: 1px solid red;
  display: flex;
  flex-direction: row;
  align-self: stretch;
  align-items: center;
`;

const ContentContainer = styled.main`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100vw;
  flex: 1;
  background-color: #f9f8f6; // grid background
  border-left: 0.5px solid black;
  border-right: 0.5px solid black;
  background-image: url("${grid}");
  padding: 48px;
  overflow-y: scroll;
  overflow-x: hidden;
`;

const Brand = styled.div`
  display: flex;
  align-self: stretch;
  align-items: center;
`;

const ConnectionContainer = styled.div`
  border-left: 0.5px solid black;
  display: flex;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  padding-left: 48px;
`;
