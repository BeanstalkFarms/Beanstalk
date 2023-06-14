import * as React from "react";
import { MouseEventHandler } from "react";
import { FC } from "src/types";
import styled from "styled-components";

type ArrowButtonType = {
  onClick: MouseEventHandler<HTMLButtonElement>;
};

export const ArrowButton: FC<ArrowButtonType> = ({ onClick }) => (
  <Container data-trace="true" >
    <Button onClick={onClick}>
      <svg width={14} height={20} fill="none" xmlns="http://www.w3.org/2000/svg" strokeWidth={1.5}>
        <path
          d="m5.333 5.417 3.75-3.75m0 0 3.75 3.75m-3.75-3.75V10m-.417 4.583-3.75 3.75m0 0-3.75-3.75m3.75 3.75v-7.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Button>
  </Container>
);

const Container = styled.div`
  display: flex;
  z-index: 100;
`;
const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  outline: 0.5px solid #9ca3af;
  outline-offset: -0.5px;
  border: none;
  box-sizing: border-box;
  background-color: #f9f8f6;
  color: #c7c8cb;

  :hover {
    background-color: #f1efec;
    cursor: pointer;
  }
  
  :focus {
    outline: 0.5px solid #46b955;
    outline-offset: -0.5px;
  }
`;
