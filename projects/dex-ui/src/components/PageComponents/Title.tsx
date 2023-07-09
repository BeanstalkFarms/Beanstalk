import React from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { BodyL, BodyXS } from "../Typography";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  fontweight?: string;
  parent?: {
    title: string;
    path: string;
  };
  center?: boolean;
};

export const Title: FC<Props> = ({ title, parent, fontweight, center }) => (
  <Container center={center}>
    <TitleContainer center={center}>
      {parent && <ParentText to={parent.path}>{parent.title} &gt;&nbsp;</ParentText>}
      <TitleText fontweight={fontweight}>{title}</TitleText>
    </TitleContainer>
  </Container>
);

type TitleProps = {
  fontweight?: string;
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
  ${(props) => props.fontweight && `font-weight: ${props.fontweight}`};
  text-transform: uppercase;
  @media (max-width: 475px) {
    ${BodyXS}
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
