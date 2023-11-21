import React from "react";

import styled, { keyframes } from "styled-components";

type ContractMarqueeInfo = Record<string, { display: string; to?: string; url?: string }[]>;

const CarouselData: ContractMarqueeInfo = {
  ADDRESS: [
    {
      display: "0x1584B668643617D18321a0BEc6EF3786F4b8Eb7B",
      url: "https://etherscan.io/address/0xBA51AAAA95aeEFc1292515b36D86C51dC7877773"
    }
  ],
  AUDIT: [
    { display: "HALBORN", url: "/halborn-basin-audit.pdf" },
    { display: "CYFRIN", url: "/cyfrin-basin-audit.pdf" },
    { display: "CODE4RENA", url: "https://code4rena.com/reports/2023-07-basin" }
  ],
  V1: [{ display: "WHITEPAPER", url: "/basin.pdf" }]
};

const speedPerItem = 16; // approx same speed as TokenMarquee
const itemGap = 24;
const numItems = 4;
const singleItemWidth = 1107.44;

export const ContractInfoMarquee = () => {
  const data = Object.entries(CarouselData);

  const totalItemWidth = numItems * singleItemWidth;
  const totalGapWidth = numItems * itemGap;

  const totalWidth = totalItemWidth + totalGapWidth;

  const repeatableWidth = totalWidth / numItems;
  const animationDuration = numItems * speedPerItem;

  return (
    <Scroller x={repeatableWidth} duration={animationDuration}>
      <CarouselRow style={{ justifyContent: "flex-start" }}>
        <>
          {Array(numItems)
            .fill(null)
            .map((_, idx) => (
              <Container key={`single-item-${idx}`}>
                {data.map(([key, data], idx) => (
                  <RowContainer key={`${key}-${idx}`}>
                    <InfoRow>
                      <InfoText>{key.toUpperCase()}:</InfoText>
                      {data.map(({ display, url }, i) => (
                        <TextLink href={url} target="_blank" rel="noopener noreferrer" key={`${display}-${i}`}>
                          {display}
                          <span>{data.length > 1 && i + 1 < data.length ? <>{","}</> : ""}</span>
                        </TextLink>
                      ))}
                    </InfoRow>
                    <InfoText>/</InfoText>
                  </RowContainer>
                ))}
              </Container>
            ))}
        </>
      </CarouselRow>
    </Scroller>
  );
};

const Scroller = styled.div<{ x: number; duration: number }>`
  background: #fff;
  padding: 16px 48px;
  box-sizing: border-box;
  border-top: 1px solid #000;

  animation-name: ${(props) => marquee(props.x)};
  animation-duration: ${(props) => props.duration}s;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
`;

const marquee = (x: number) => keyframes` 
    0% { transform: translateX(0px); }
    100% { transform: translateX(-${x}px);}
`;

const CarouselRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  gap: 24px;
`;

const Container = styled.div`
  display: flex;
  flex-direction: row;
  gap: 24px;
`;

const RowContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 24px;
`;

const InfoRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  white-space: nowrap;
`;

const InfoText = styled.div`
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: 24px;
`;

const TextLink = styled.a`
  color: #46b955;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0.32px;
  text-decoration-line: underline;
`;
