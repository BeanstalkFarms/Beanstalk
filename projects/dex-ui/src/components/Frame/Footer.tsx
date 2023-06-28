import React from "react";
import styled from "styled-components";
import { Discord, Github, Twitter } from "../Icons";

export const Footer = () => (
  <Container>
    <Box href="https://github.com/BeanstalkFarms/Beanstalk/tree/dex-prod/projects/dex-ui" rel="noopener noreferrer" target="_blank">We are open source. Contribute to this site →</Box>
    <Box>Join the discussion</Box>
    <SmallBox href="https://basin.exchange/discord" rel="noopener noreferrer" target="_blank">
      <Discord width={20} />
    </SmallBox>
    <SmallBox href="https://twitter.com/basinexchange" rel="noopener noreferrer" target="_blank">
      <Twitter width={20} />
    </SmallBox>
    <SmallBox href="https://github.com/BeanstalkFarms/Basin" rel="noopener noreferrer" target="_blank">
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

const Box = styled.a`
  display: flex;
  flex: 1;
  border-left: 1px solid black;
  justify-content: center;
  align-items: center;
  text-decoration: none;
  color: black;
  :first-child {
    border-left: none;
  }
`;
const SmallBox = styled.a`
  display: flex;
  width: 64px;
  border-left: 1px solid black;
  justify-content: center;
`;
