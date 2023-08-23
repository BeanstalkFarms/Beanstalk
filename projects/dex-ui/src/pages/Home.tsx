/* eslint-disable jsx-a11y/accessible-emoji */
import React from "react";
import { size } from "src/breakpoints";
import { Link } from "react-router-dom";
import { RightArrow, RightArrowCircle } from "src/components/Icons";
import styled from "styled-components";

export const Home = () => {
  return (
    <Container>
      <Content>
        <MevBubble>
          <svg xmlns="http://www.w3.org/2000/svg" width={8} height={8} fill="none">
            <circle cx={4} cy={4} r={4} fill="#46B955" />
          </svg>
          🔮 Multi-block MEV manipulation resistant oracle{" "}
          <OracleWP href="/multi-flow-pump.pdf" target="_blank">
            whitepaper
          </OracleWP>
          <RightArrowCircle />
        </MevBubble>
        <TitleSubtitleContainer>
          <Title>A Composable EVM-native DEX </Title>
          <SubTitle>
            Customizable liquidity pools with shared components. &nbsp;
            <WhitepaperLink href={"/basin.pdf"} target="_blank">
              Read the whitepaper
              <RightArrow color="#46B955" />
            </WhitepaperLink>
          </SubTitle>
        </TitleSubtitleContainer>
        <Boxes>
          <Box to="/">
            <Emoji role="img" aria-label="crystal ball">
              🔮
            </Emoji>{" "}
            Build using components
          </Box>
          <Box to="/wells">
            <Emoji role="img" aria-label="lightning">
              ⚡️
            </Emoji>{" "}
            Deploy flexible liquidity
          </Box>
          <Box to="/swap">
            <Emoji role="img" aria-label="heart">
              ❤️
            </Emoji>{" "}
            Zero-fee swaps
          </Box>
        </Boxes>
      </Content>
    </Container>
  );
};

const Container = styled.div`
  height: calc(100% - 24px);
  padding: 12px;
  @media (min-width: ${size.mobile}) {
    padding: 0px;
    height: 100%;
    width: 100%;
    justify-content: center;
    align-items: center;
  }
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  @media (min-width: ${size.mobile}) {
    gap: 48px;
    justify-content: center;
    align-items: center;
  }
`;

const MevBubble = styled.div`
  display: none;
  @media (min-width: ${size.mobile}) {
    display: flex;
    box-sizing: border-box;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px;
    gap: 8px;
    height: 40px;
    line-height: 16px;
    width: 522px;
    background: #ffffff;
    border: 0.25px solid #4b5563;
    border-radius: 100px;
  }
`;

const TitleSubtitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  @media (min-width: ${size.mobile}) {
    display: flex;
    flex-direction: column;
    gap: 48px;
  }
`;

const Title = styled.div`
  font-size: 32px;
  font-weight: 600;
  line-height: 40px;
  @media (min-width: ${size.mobile}) {
    font-style: normal;
    font-size: 72px;
    line-height: 100%;
  }
`;

const SubTitle = styled.div`
  display: flex;
  flex-direction: column;
  align-items: left;
  font-style: normal;
  font-weight: 400;
  font-size: 14px;
  line-height: 22px;
  color: #4b5563;
  gap: 8px;
  @media (min-width: ${size.mobile}) {
    flex-direction: row;
    font-size: 20px;
    line-height: 24px;
    align-items: center;
    justify-content: center;
    gap: 0px;
  }
`;

const OracleWP = styled.a`
  color: #46b955;
  text-decoration: none;
  display: flex;
  align-items: center;
`;

const WhitepaperLink = styled.a`
  font-weight: 400;
  font-size: 14px;
  line-height: 22px;
  text-align: center;
  color: #46b955;
  text-decoration: none;
  display: flex;
  align-items: center;

  @media (min-width: ${size.mobile}) {
    font-size: 20px;
    line-height: 24px;
  }
`;

const Boxes = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: space-around;
  position: fixed;
  bottom: 12px;
  width: calc(100vw - 24px);
  @media (min-width: ${size.mobile}) {
    flex-direction: row;
    position: relative;
    bottom: 0px;
    gap: 48px;
    padding: 0 48px;
    width: 100vw;
  }
`;

const Box = styled(Link)`
  display: flex;
  justify-content: center;
  align-items: center;

  background: #f9f8f6;
  border: 0.5px solid #4b5563;
  flex-grow: 1;

  font-weight: 600;
  font-size: 14px;
  line-height: 22px;
  padding: 12px;

  text-decoration: none;
  color: black;

  @media (min-width: ${size.mobile}) {
    padding: 0px;
    font-size: 24px;
    line-height: 32px;
    height: 80px;
  }
`;

const Emoji = styled.span`
  margin-right: 4px;
`;
