import React from "react";
import { size } from "src/breakpoints";
import styled, { keyframes } from "styled-components";
import { images } from "src/assets/images/tokens";
import { Image } from "../Image";
import { useTokens } from "src/tokens/TokenProvider";

const randomKey = () => Math.random().toString(36).substring(2, 7);

export const TokenMarquee = () => {
  const tokens = useTokens();

  // Get tokens from wells, but if there aren't any (wrong network connected or something),
  // just display ETH and BEAN
  const symbols = Object.values(tokens).map((token) => token.symbol);
  if (symbols.length === 0) {
    symbols.push("BEAN", "WETH");
  }

  // Remove ETH, as it would be a dup with WETH
  if (symbols[symbols.length - 1] === "ETH") symbols.pop();

  // we need distinct keys for these, so we return a function so the key can be set later
  const logos = symbols.map((symbol) => (key: string) => (
    <Image key={key} src={images[symbol]} height={24} width={24} alt={`${symbol} Logo`} />
  ));

  logos.push((key: string) => <Circle key={key} />);

  // a block is a logo + space to the right, so 24+64 pixels. Assuming a 2000px max screen
  // width, that gives us about 22 blocks. So we loop through available logos until we use
  // 22 of them
  const blocks = 22;

  // Time, in seconds, for how we want it to take to scroll one block, ie, one token over.
  const speedPerBlock = 5;

  const repeatableWidth = logos.length * (24 + 64);
  const animationDuration = logos.length * speedPerBlock;

  const scrollableLogos = [];

  for (let i = 0; i < blocks; i++) {
    const getComponent = logos[i % logos.length];
    scrollableLogos.push(getComponent(randomKey()));
  }

  return (
    <Container>
      <Scroller x={repeatableWidth} duration={animationDuration}>
        {scrollableLogos}
      </Scroller>
    </Container>
  );
};

const Container = styled.div`
  display: none;

  @media (min-width: ${size.mobile}) {
    display: flex;
    align-items: center;
    height: 48px;
    min-height: 48px;
    box-sizing: border-box;
    border-left: 0.5px solid black;
    border-right: 0.5px solid black;
    border-bottom: 0.25px solid black;
    width: 100vw;
  }
`;

const Scroller = styled.div<{ x: number; duration: number }>`
  display: flex;
  gap: 64px;
  padding-right: 64px;

  animation-name: ${(props) => marquee(props.x)};
  animation-duration: ${(props) => props.duration}s;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
`;

const marquee = (x: number) => keyframes` 
    0% { transform: translateX(0px); }
    100% { transform: translateX(-${x}px);}
`;

const Circle = () => {
  const items = [
    <circle
      key={1}
      cx={12}
      cy={12}
      r={11.75}
      fill="#F5F3FF"
      stroke="#4C1D95"
      strokeDasharray="1.5 1.5"
      strokeLinecap="round"
      strokeWidth={0.5}
    />,
    <circle
      key={2}
      cx="12"
      cy="12"
      r="11.75"
      fill="#FFF1F2"
      stroke="#881337"
      strokeWidth="0.5"
      strokeLinecap="round"
      strokeDasharray="1.5 1.5"
    />,
    <circle
      key={23}
      cx="12"
      cy="12"
      r="11.75"
      fill="#F0FDF4"
      stroke="#14532D"
      strokeWidth="0.5"
      strokeLinecap="round"
      strokeDasharray="1.5 1.5"
    />
  ];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="none">
      {items[Math.floor(Math.random() * items.length)]}
    </svg>
  );
};
