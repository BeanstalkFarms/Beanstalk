import React from "react";

import { Link } from "react-router-dom";
import styled from "styled-components";

import { size } from "src/breakpoints";
import { FC } from "src/types";

import { BodyL, BodyS, H3 } from "../Typography";

type Props = {
  title: string;
  fontWeight?: string;
  parent?: {
    title: string;
    path: string;
  };
  center?: boolean;
  largeOnMobile?: boolean;
};

export const Title: FC<Props> = ({ title, parent, fontWeight, center, largeOnMobile }) => (
  <Container center={center}>
    <TitleContainer center={center}>
      {parent && <ParentText to={parent.path}>{parent.title} &gt;&nbsp;</ParentText>}
      <TitleText fontWeight={fontWeight} largeOnMobile={largeOnMobile}>
        {title}
      </TitleText>
    </TitleContainer>
  </Container>
);

type TitleProps = {
  fontWeight?: string;
  largeOnMobile?: boolean;
};

type TitleContainerProps = {
  center?: boolean;
};

const Container = styled.div<TitleContainerProps>`
  display: flex;
  flex-direction: row;
  align-items: center;

  @media (max-width: ${size.mobile}) {
    justify-content: start;
  }
`;

const TitleContainer = styled.div<TitleContainerProps>`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const TitleText = styled.div<TitleProps>`
  ${H3}
  ${(props) => props.fontWeight && `font-weight: ${props.fontWeight}`};
  text-transform: uppercase;
  @media (max-width: ${size.mobile}) {
    ${({ largeOnMobile }) => (largeOnMobile ? `${H3}` : `${BodyS}`)}
  }
`;
const ParentText = styled(Link)`
  ${BodyL}
  color: #9CA3AF;
  text-decoration: none;
  text-transform: uppercase;
  @media (max-width: ${size.mobile}) {
    ${BodyS}
  }
  :hover {
    color: #000000;
  }
`;
