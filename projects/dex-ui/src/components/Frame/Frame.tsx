import React from "react";
import { Link } from "react-router-dom";
import { FC } from "src/types";
import styled from "styled-components";
import { ConnectKitButton } from "connectkit";
import { Footer } from "./Footer";
import { Window } from "./Window";
import { Settings } from "src/settings";
import CustomToaster from "../TxnToast/CustomToaster";
import buildIcon from "src/assets/images/navbar/build.svg";
import swapIcon from "src/assets/images/navbar/swap.svg";
import wellsIcon from "src/assets/images/navbar/wells.svg";
import { LinksNav } from "../Typography";
import { Logo } from "../Icons";

export const BasinConnectButton = () => {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, truncatedAddress, ensName }) => {
        return <StyledConnectButton onClick={show}>{isConnected ? ensName ?? truncatedAddress : "Connect Wallet"}</StyledConnectButton>;
      }}
    </ConnectKitButton.Custom>
  );
};

export const Frame: FC<{}> = ({ children }) => {
  const isNotProd = !Settings.PRODUCTION;

  return (
    <Container id="frame">
      <NavContainer>
        <BrandContainer>
          <Brand>
            <Link to={"/"}>
              <Logo /> <div>BASIN</div>
            </Link>
          </Brand>
        </BrandContainer>
        <RightSide>
          <NavLinks>
            <NavLink to="/wells" hovericon={wellsIcon}>
              Liquidity
            </NavLink>
            <NavLink to="/build" hovericon={buildIcon}>
              Build
            </NavLink>
            <NavLink to="/swap" hovericon={swapIcon}>
              Swap
            </NavLink>
            {isNotProd && <NavLink to="/dev">Dev</NavLink>}
          </NavLinks>
        </RightSide>
        <StyledConnectContainer>
          <BasinConnectButton />
        </StyledConnectContainer>
        <DropdownMenu>
          =
        </DropdownMenu>
      </NavContainer>
      <TokenMarquee />
      <Window>
        <CustomToaster />
        {children}
      </Window>
      <Footer />
    </Container>
  );
};

type NavLinkProps = {
  hovericon?: string;
};

const TokenMarquee = styled.div`
  display: none;

  @media (min-width: 475px) {
    display: flex;
    height: 48px;
    min-height: 48px;
    box-sizing: border-box;
    border-left: 0.5px solid black;
    border-right: 0.5px solid black;
    border-bottom: 0.25px solid black;
    width: 100vw;
  }
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
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  padding: 0px;
  align-items: center;
  @media (min-width: 475px) {
    height: 64px;
    min-height: 64px;
  }
`;

const NavLinks = styled.div`
  display: none;
  @media (min-width: 475px) {
    display: flex;
    align-self: stretch;
    align-items: center;
  }
`;
const NavLink = styled(Link)<NavLinkProps>`
  border-left: 0.5px solid black;
  box-sizing: border-box;
  display: flex;
  width: 192px;
  align-self: stretch;
  align-items: center;
  justify-content: center;

  text-decoration: none;
  text-transform: uppercase;

  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  color: black;
  outline: none !important;
  cursor: ${(props) => (props.hovericon ? `url(${props.hovericon}), auto` : "pointer")};

  :focus {
    outline: none !important;
  }
  :hover {
    background-color: #f0fdf4;
  }
  &:last-child {
    border-right: 0.5px solid black;
  }
`;
const RightSide = styled.div`
  // border: 1px solid red;
  display: flex;
  flex-direction: row;
  align-self: stretch;
  align-items: center;
`;

const BrandContainer = styled.div`
  display: flex;
  direction: row;
  flex: 1;
  align-self: stretch;
  align-items: center;
`;

const Brand = styled.div`
  display: flex;
  flex-direction: row;
  padding-left: 16px;
  
    a {
      display: flex;
      align-items: center;
      gap: 4px;
      ${LinksNav}
      text-decoration: none;
      text-transform: uppercase;
      color: #0f172a;

      :focus {
        outline: none;
      }
    }

    @media (min-width: 475px) {
      padding-left: 48px;
    }
`;

const StyledConnectContainer = styled.div`
  display: none;
  @media (min-width: 475px) {
    display: flex;
    direction: row;
    flex: 1;
    align-self: stretch;
    align-items: center;
    justify-content: center;
  }
`;

const StyledConnectButton = styled.button`
  display: flex;
  direction: row;
  flex: 1;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  border: 1px dotted red;
  cursor: pointer;
  border: 0px;
  color: #000;
  background: #fff;
  :hover {
    background-color: #f0fdf4;
  }
`;

const DropdownMenu = styled.button`
  cursor: pointer;
  border: 0px;
  color: #000;
  background: #fff;
  :hover {
    background-color: #f0fdf4;
  }
  height: 100%;
  padding-left: 16px;
  padding-right: 16px;
  font-size: 24px;
  @media (min-width: 475px) {
    display: none;
  }
`
