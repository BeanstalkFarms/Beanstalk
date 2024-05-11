import React from "react";
import styled from "styled-components";

export const NotFound = () => {
  return (
    <>
      <NotFoundContainer>
        <LargeText>
          404
        </LargeText>
        <SmallText>
          Page Not Found
        </SmallText>
      </NotFoundContainer>
    </>
  );
};

const NotFoundContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`

const LargeText = styled.div`
  font-size: 100px;
  line-height: 80px;
`

const SmallText = styled.div`
  font-size: 24px;
  margin-left: 2px;
`
