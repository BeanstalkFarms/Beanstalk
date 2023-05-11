import React from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { BodyL } from "../Typography";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  parent?: {
    title: string;
    path: string;
  };
};

export const Title: FC<Props> = ({ title, parent }) => (
  <Container>
    {parent && <ParentText to={parent.path}>{parent.title} &gt;&nbsp;</ParentText>}
    <TitleText>{title}</TitleText>
  </Container>
);

const Container = styled.div`
  display: flex;
  flex-direction: row;
`;
const TitleText = styled.div`
  ${BodyL}
  text-transform: uppercase;
`;
const ParentText = styled(Link)`
  ${BodyL}
  color: #9CA3AF;
  text-decoration: none;
  text-transform: uppercase;
`;
