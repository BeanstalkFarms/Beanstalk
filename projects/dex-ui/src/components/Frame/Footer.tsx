import React from "react";

import styled from "styled-components";

import { mediaQuery, size } from "src/breakpoints";

import { BeanstalkLogoBlack, Discord, Github, Twitter } from "../Icons";

export const Footer = () => (
  <Container>
    <Box href="https://docs.basin.exchange" rel="noopener noreferrer" target="_blank">
      <InfoText>
        <span role="img" aria-label="Documentation">
          📃 Protocol Documentation
        </span>
      </InfoText>
      <StyledLink>Visit the Docs →</StyledLink>
    </Box>
    <Box href="https://immunefi.com/bounty/beanstalk/" rel="noopener noreferrer" target="_blank">
      <InfoText>
        <span role="img" aria-label="Bug Bounty">
          👾 Basin Bug Bounty Program
        </span>
      </InfoText>
      <StyledLink>Learn More →</StyledLink>
    </Box>
    <SmallBox href="https://basin.exchange/discord" rel="noopener noreferrer" target="_blank">
      <Discord width={20} />
    </SmallBox>
    <SmallBox href="https://twitter.com/basinexchange" rel="noopener noreferrer" target="_blank">
      <Twitter width={20} />
    </SmallBox>
    <SmallBox
      href="https://github.com/BeanstalkFarms/Basin"
      rel="noopener noreferrer"
      target="_blank"
    >
      <Github width={20} />
    </SmallBox>
    <SmallBox href="https://bean.money" rel="noopener noreferrer" target="_blank">
      <BeanstalkLogoBlack width={20} />
    </SmallBox>
  </Container>
);

const Container = styled.footer`
  display: none;
  flex-direction: row;
  box-sizing: border-box;
  border: 1px solid black;
  height: 56px;
  min-height: 56px;
  width: 100vw;
  align-items: stretch;
  @media (min-width: ${size.mobile}) {
    display: flex;
    height: 72px;
    min-height: 72px;
  }
`;

const Box = styled.a`
  display: flex;
  flex: 2;
  border-left: 1px solid black;
  justify-content: center;
  align-items: center;
  text-decoration: none;
  color: black;
  gap: 16px;
  :hover {
    background-color: #f0fdf4;
  }
  :first-child {
    border-left: none;
  }

  ${mediaQuery.md.only} {
    flex-wrap: wrap;
    gap: 8px;
    flex-flow: column;
  }
`;

const InfoText = styled.div`
  whitespace: nowrap;
`;

const SmallBox = styled.a`
  display: flex;
  width: 64px;
  border-left: 1px solid black;
  justify-content: center;
  align-items: center;
  :hover {
    background-color: #f0fdf4;
  }
`;

const StyledLink = styled.span`
  text-decoration: underline;
  white-space: nowrap;
`;
