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
        <NavLinks>
          {/* <Link to="/"> */}
          <svg width={32} height={32} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#a)">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.071 8.929 0 16l7.071 7.071L14.142 16l-7.07-7.071Zm8.485 8.485-7.07 7.071 7.07 7.071 7.071-7.07-7.07-7.072Zm-7.07-9.9 7.07-7.07 7.071 7.07-7.07 7.072-7.072-7.071ZM24.041 8.93 16.97 16l7.07 7.071L31.114 16l-7.071-7.071Z"
                fill="#fff"
              />
            </g>
            <defs>
              <clipPath id="a">
                <path fill="#fff" d="M0 0h32v32H0z" />
              </clipPath>
            </defs>
          </svg>
          {/* </Link> */}

          <Link to="/swap">Swap</Link>
          <Link to="/wells">Wells</Link>
          <Link to="/silo">Silo</Link>
        </NavLinks>
        <ConnectArea>
          {net}
          <ConnectKitButton />
        </ConnectArea>
      </NavContainer>
      <ContentContainer>{children}</ContentContainer>
    </Container>
  );
};

const Container = styled.div`
  // border: 1px solid red;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100vw;
  align-items: center;
`;

const NavContainer = styled.div`
  // border-bottom: 1px solid gray;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100vw;
  box-sizing: border-box;
  padding: 5px 40px;
  align-items: center;
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`;
const ConnectArea = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const ContentContainer = styled.div`
  border: 1px solid green;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 20px;
  align-items: center;
  width: 1200px
`;
