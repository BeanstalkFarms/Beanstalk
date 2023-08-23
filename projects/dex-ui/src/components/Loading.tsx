import React from "react";
import { Footer } from "src/components/Frame/Footer";
import { Frame } from "src/components/Frame/Frame";
import { Spinner2 } from "src/components/Spinner2";
import styled from "styled-components";

type LoadingProps = {
  spinnerOnly?: boolean;
}

export const Loading = ({spinnerOnly}: LoadingProps) => {
  return (
    <>
      {!spinnerOnly && <Frame />}
      <SpinnerContainer>
        <Spinner2 size={72}/>
      </SpinnerContainer>
      {!spinnerOnly && <Footer />}
    </>
  );
};

const SpinnerContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`