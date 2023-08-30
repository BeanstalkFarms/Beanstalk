import React from "react";
import { Footer } from "src/components/Frame/Footer";
import { Frame } from "src/components/Frame/Frame";
import styled from "styled-components";

type ErrorProps = {
  message: string;
  errorOnly?: boolean;
}

export const Error = ({ message, errorOnly }: ErrorProps) => {
  return (
    <>
      {!errorOnly && <Frame />}
        <ErrorContainer>
            <LargeText>
                Oops!
            </LargeText>
            <SmallText>
                {"Something went wrong :("}
            </SmallText>
            <ErrorBox>
                {message}
            </ErrorBox>
        </ErrorContainer>
      {!errorOnly && <Footer />}
    </>
  );
};

const ErrorContainer = styled.div`
  display: grid;
  gap: 12px;
  justify-items: center;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`

const LargeText = styled.div`
  font-size: 100px;
  line-height: 90px;
`

const SmallText = styled.div`
  font-size: 24px;
  margin-left: 2px;
`

const ErrorBox = styled.div`
  width: 95vw;
  text-align: center;
`