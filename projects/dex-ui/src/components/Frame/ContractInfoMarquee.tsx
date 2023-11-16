import React from "react";

import styled, { keyframes } from "styled-components";

const CarouselData: Record<string, { display: string; to: string }> = {
  ADDRESS: {
    display: "0x1584B668643617D18321a0BEc6EF3786F4b8Eb7B",
    to: "/" // TODO: link to etherscan
  },
  DEPLOY: {
    display: "17113653",
    to: "/" // TODO: link to etherscan
  },
  AUDIT: {
    display: "HALBORN, CYFRIN",
    to: "https://www.halborn.com/" // TODO: link to audit
  },
  V1: {
    display: "WHITEPAPER",
    to: "/basin.pdf"
  }
};

export const ContractInfoMarqueeHeight = 57;

export const ContractInfoMarquee = () => {
  const data = Object.entries(CarouselData);

  /// See TokenMarquee.tsx for more info on how this works
  const speedPerItem = 25;
  const repeatableWidth = 1192.34;
  const numItems = 3;
  const animationDuration = numItems * speedPerItem;

  return (
    <Scroller x={repeatableWidth} duration={animationDuration}>
      <CarouselRow style={{ justifyContent: "flex-start" }}>
        <>
          {Array(numItems + 1)
            .fill(null)
            .map((_, idx) => (
              <Container key={`single-item-${idx}`}>
                {data.map(([key, { display, to }], idx) => (
                  <RowContainer key={`${key}-${idx}`}>
                    <InfoRow>
                      <InfoText>{key.toUpperCase()}:</InfoText>
                      <TextLink href={to} target="_blank" rel="noopener noreferrer">
                        {display}
                      </TextLink>
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
`;

const Container = styled.div`
  display: flex;
  flex-direction: row;
  gap: 24px;
  margin-right: 24px;
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
