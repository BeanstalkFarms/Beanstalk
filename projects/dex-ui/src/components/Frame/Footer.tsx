import React from "react";
import styled from "styled-components";
import { Discord, Github, Twitter } from "../Icons";

export const Footer = () => (
  <Container>
    <Box>We are open source. Contribute to this site →</Box>
    <Box>Join the discussion</Box>
    <SmallBox>
      <Discord width={20} />
    </SmallBox>
    <SmallBox>
      <Twitter width={20} />
    </SmallBox>
    <SmallBox>
      <Github width={20} />
    </SmallBox>
  </Container>
);

const Container = styled.footer`
  display: flex;
  flex-direction: row;
  box-sizing: border-box;
  border: 1px solid black;
  min-height: 72px;
  width: 100vw;
  align-items: stretch;
`;

const Box = styled.div`
  display: flex;
  flex: 1;
  border-left: 1px solid black;
  justify-content: center;
  align-items: center;
  :first-child {
    border-left: none;
  }
`;
const SmallBox = styled.div`
  display: flex;
  width: 64px;
  border-left: 1px solid black;
  justify-content: center;
`;
