import React from "react";
import { Link } from "react-router-dom";
import { FC } from "src/types";
import styled from "styled-components";
import { ConnectKitButton } from "connectkit";
import { useNetwork } from "wagmi";

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
    <Container>
      <NavContainer>
        <div>
          <Link to="/">Home</Link>
        </div>
        <NavLinks>
          <Link to="/swap">Swap</Link>
          <Link to="/wells">Wells</Link>
          <Link to="/silo">Silo</Link>
        </NavLinks>
        <ConnectArea>
          {net}
          <ConnectKitButton showBalance />
        </ConnectArea>
      </NavContainer>
      <ContentContaine>{children}</ContentContaine>
    </Container>
  );
};

const Container = styled.div`
  // border: 1px solid red;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100vw;
`;

const NavContainer = styled.div`
  // border: 1px solid blue;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  box-sizing: border-box;
  padding: 20px;
`;

const NavLinks = styled.div`
  display: flex;
  gap: 20px;
`;
const ConnectArea = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;

`

const ContentContaine = styled.div`
  // border: 1px solid green;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 20px;
  align-items: center;
`;
