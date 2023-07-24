import React from "react";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  src: string;
  size?: number;
  width?: number;
  height?: number;
  alt: string;
  onClick?: () => void;
};

export const Image: FC<Props> = ({ width, height, src, alt = "Image", onClick }) => {
  return (
    <Container onClick={onClick}>
      <img src={src} alt={alt} width={width} height={height} />
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  ${(props) => props.onClick && "cursor: pointer;"}
`;
