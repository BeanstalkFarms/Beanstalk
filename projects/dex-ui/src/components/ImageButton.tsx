import React from "react";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  src: string;
  size?: number;
  alt: string;
  padding?: string;
  onClick: () => void;
};

type StyleProps = {
  padding?: string;
};

export const ImageButton: FC<Props> = ({ size = 32, src, alt = "Image", onClick, padding }) => {
  return (
    <Button onClick={onClick} padding={padding}>
      <img src={src} alt={alt} width={size} />
    </Button>
  );
};

const Button = styled.button<StyleProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  border: none;
  background: none;
  padding: ${(props) => props.padding ?? "5px"};
  ${(props) => props.onClick && "cursor: pointer;"};
`;
