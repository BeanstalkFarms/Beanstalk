import React from "react";
import { Link } from "react-router-dom";
import { FC } from "src/types";
import styled from "styled-components";
export const Frame: FC<{}> = ({ children }) => {
  return (
    <Container>
      <NavContainer>
        <div>
          <Link to="/">Home</Link>
        </div>
        <NavLinks>
          <Link to="/swap">Swap</Link>
          <Link to="/wells">Wells</Link>
        </NavLinks>
        <div>Connect</div>
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

const ContentContaine = styled.div`
  // border: 1px solid green;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 20px;
  align-items: center;
`;
