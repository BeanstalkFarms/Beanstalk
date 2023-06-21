/* eslint-disable jsx-a11y/accessible-emoji */
import React from "react";
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
          🔮 Multi-block MEV manipulation resistant Oracle now live
          <RightArrowCircle />
        </MevBubble>
        <Title>A Composable EVM-native DEX </Title>
        <SubTitle>
          Customizable liquidity pools with shared components. &nbsp;
          <WhitepaperLink href={"/whitepaper.pdf"} target="_blank">
            Read the Whitepaper
            <RightArrow color="#46B955" />
          </WhitepaperLink>
        </SubTitle>
        <Boxes>
          <Box>
            <Emoji role="img" aria-label="crystal ball">
              🔮
            </Emoji>{" "}
            Build using components
            <RightArrow />
          </Box>
          <Box>
            <Emoji role="img" aria-label="lightning">
              ⚡️
            </Emoji>{" "}
            Deploy flexible liquidity <RightArrow />
          </Box>
          <Box>
            <Emoji role="img" aria-label="heart">
              ❤️
            </Emoji>{" "}
            Zero-fee Swaps <RightArrow />
          </Box>
        </Boxes>
      </Content>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  height: 100%;
  width: 100%;

  justify-content: center;
  align-items: center;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 48px;
  align-items: center;
`;

const MevBubble = styled.div`
  display: flex;
  box-sizing: border-box;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 8px;
  gap: 8px;
  height: 40px;
  width: 495px;
  background: #ffffff;
  border: 0.25px solid #4b5563;
  border-radius: 100px;
`;

const Title = styled.div`
  font-family: "PP Mori";
  font-style: normal;
  font-weight: 600;
  font-size: 72px;
  line-height: 100%;
`;

const SubTitle = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  font-family: "PP Mori";
  font-style: normal;
  font-weight: 400;
  font-size: 20px;
  line-height: 24px;
  color: #4b5563;
`;

const WhitepaperLink = styled.a`
  font-weight: 400;
  font-size: 20px;
  line-height: 24px;
  text-align: center;
  color: #46b955;
  text-decoration: none;
  display: flex;
  align-items: center;
`;

const Boxes = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  gap: 48px;
  width: 100vw;
  justify-content: space-around;
  padding: 0 48px;
`;

const Box = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  height: 80px;
  background: #f9f8f6;
  border: 0.5px solid #4b5563;
  flex-grow: 1;

  font-weight: 600;
  font-size: 24px;
  line-height: 32px;
`;

const Emoji = styled.span`
  margin-right: 4px;
`;
