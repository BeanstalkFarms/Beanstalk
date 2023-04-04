import React from "react";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  src: string;
  size?: number;
  alt: string;
  onClick?: () => void;
};

export const Image: FC<Props> = ({ size = 32, src, alt = "Image", onClick }) => {
  return (
    <Container onClick={onClick}>
      <img src={src} alt={alt} width={size} />
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  ${(props) => props.onClick && "cursor: pointer;"}
`;
