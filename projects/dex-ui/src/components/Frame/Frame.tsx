import React, { useState } from "react";
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
import { Discord, Github, Logo, Twitter } from "../Icons";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <Container id="frame">
      <NavContainer>
        <BrandContainer onClick={() => setMobileMenuOpen(false)}>
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
        <DropdownMenu open={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <MenuLine />
          <MenuLine />
        </DropdownMenu>
      </NavContainer>
      <TokenMarquee />
      <Window>
        <CustomToaster />
        <BurgerMenu open={mobileMenuOpen}>
          <MobileNavLinkContainer>
            <MobileNavLink bold to="/swap" onClick={() => setMobileMenuOpen(false)}>Swap</MobileNavLink>
            <MobileNavLink bold to="/wells" onClick={() => setMobileMenuOpen(false)}>Wells</MobileNavLink>
            <MobileNavLink bold to="/build" onClick={() => setMobileMenuOpen(false)}>Build</MobileNavLink>
            {isNotProd && <MobileNavLink bold to="/dev" onClick={() => setMobileMenuOpen(false)}>Dev</MobileNavLink>}
            <MobileLargeNavRow onClick={() => setMobileMenuOpen(false)}>
              <Box href="https://basin.exchange/discord" rel="noopener noreferrer" target="_blank">
                <Discord width={20} />
              </Box>
              <Box href="https://twitter.com/basinexchange" rel="noopener noreferrer" target="_blank">
                <Twitter width={20} />
              </Box>
              <Box href="https://github.com/BeanstalkFarms/Basin" rel="noopener noreferrer" target="_blank">
                <Github width={20} />
              </Box>
            </MobileLargeNavRow>
            <MobileNavLink to="/build" onClick={() => setMobileMenuOpen(false)}>Bug Bounty Program</MobileNavLink>
            <MobileNavLink to="/build" onClick={() => setMobileMenuOpen(false)}>Documentation</MobileNavLink>
          </MobileNavLinkContainer>
          <MobileConnectContainer>
            <BasinConnectButton />
          </MobileConnectContainer>
        </BurgerMenu>
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
  border-bottom: 0.5px solid black;
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

const DropdownMenu = styled.button<{open?: boolean}>`
  cursor: pointer;
  border: 0px;
  color: #000;
  background: #fff;
  :hover {
    background: #FFF;
  }
  :focus {
    outline: #FFF;
  }
  height: 100%;
  padding-left: 16px;
  padding-right: 16px;
  font-size: 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 9px;
  @media (min-width: 475px) {
    display: none;
  }
  div {
    :first-child { 
      transition: all 0.3s linear;
      transform-origin: 0% 50%;
      transform: ${({  open  }) => open ? `rotate(45deg)` : `rotate(0)`};
    }
    :last-child {
      transition: all 0.3s linear;
      transform-origin: 0% 50%;
      transform: ${({  open  }) => open ? `rotate(-45deg)` : `rotate(0)`};
    }
  }
`

const MenuLine = styled.div`
  width: 16px;
  height: 2px;
  background-color: black;
`

const BurgerMenu = styled.div<{open: boolean}>`
  background-color: #FFF;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
  width: 100vw;
  justify-content: space-between;
  position: absolute;
  transition: transform 0.3s ease-in-out;
  border-left: 0.5px solid black;
  margin-left: -0.5px;
  transform: ${(props) => props.open ? `translateX(0%)` : `translateX(100%)`};
  z-index: 9999;
  @media (min-width: 475px) {
    display: none;
  }
`

const MobileNavLinkContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
`

const MobileNavLink = styled(Link)<{bold?: boolean}>`
  width: 100%;
  border-bottom: 0.5px solid black;
  padding: 16px;
  text-transform: uppercase;
  text-decoration: none;
  color: black;
  font-weight: ${(props) => props.bold ? `600` : `normal`};
  ${(props) => props.bold && `letter-spacing: 0.96px;`}
`

const MobileLargeNavRow = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  border-bottom: 0.5px solid black;
  color: black;
`

const MobileConnectContainer = styled.div`
  display: flex;
  direction: row;
  padding: 16px;
  align-self: stretch;
  justify-content: center;
  border-top: 0.5px solid black;
`;

const Box = styled.a`
  display: flex;
  flex: 1;
  padding: 32px;
  border-left: 0.5px solid black;
  justify-content: center;
  align-items: center;
  text-decoration: none;
  color: black;
  :first-child {
    border-left: none;
  }
`;
