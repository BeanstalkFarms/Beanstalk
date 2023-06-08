import React, { JSXElementConstructor } from "react";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  size?: number;
  alt: string;
  padding?: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
} & ({ src: string; component?: never } | { src?: never; component?: JSXElementConstructor<any> });

type StyleProps = {
  padding?: string;
};

// This component supports accepting either an imagine in two ways:
// -- as a string url via `src`
// -- as an SVG component via `component`. See src/components/Icons.tsx
// for acceptable components
export const ImageButton: FC<Props> = ({ size = 32, src, component, alt = "Image", onClick, padding }) => {
  return (
    <Button onClick={onClick} padding={padding}>
      {src && <img src={src} alt={alt} width={size} />}
      {component && React.createElement(component, { width: size, height: size, color: "#000" })}
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
