import React from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { BodyL, BodyXS, H2 } from "../Typography";
import { Link } from "react-router-dom";

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

  @media (max-width: 475px) {
    justify-content: start;
  }
`;

const TitleContainer = styled.div<TitleContainerProps>`
  display: flex;
  flex-direction: row;
`;

const TitleText = styled.div<TitleProps>`
  ${BodyL}
  ${(props) => props.fontWeight && `font-weight: ${props.fontWeight}`};
  text-transform: uppercase;
  @media (max-width: 475px) {
    ${({ largeOnMobile }) => (largeOnMobile ? `${H2}` : `${BodyXS}`)}
  }
`;
const ParentText = styled(Link)`
  ${BodyL}
  color: #9CA3AF;
  text-decoration: none;
  text-transform: uppercase;
  @media (max-width: 475px) {
    ${BodyXS}
  }
`;
