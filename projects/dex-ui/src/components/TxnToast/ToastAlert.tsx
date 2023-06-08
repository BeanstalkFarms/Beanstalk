import React, { useCallback } from "react";
import toast from "react-hot-toast";
import { Link as Linky } from "react-router-dom";
import styled from "styled-components";
import { ImageButton } from "src/components/ImageButton";
import { Copy, X } from "../Icons";
import { BodyCaps, BodyS, LinksTextLink } from "../Typography";

function dismissErrors(id?: any) {
  if (id) {
    toast.dismiss(id);
  } else {
    toast.dismiss();
  }
}

export function ToastAlert({ desc, hash, msg, rawError, id }: { desc?: string; hash?: string; msg?: string; rawError?: string; id?: any }) {
  const handleClick = useCallback(() => (id !== null ? dismissErrors(id) : dismissErrors()), [id]);

  return (
    <Container>
      <Text>
        <Title>{desc}</Title>
        {hash && (
          <Link href={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">
            View on Etherscan
          </Link>
        )}

        {msg && <MessageContainer>{msg}</MessageContainer>}
      </Text>
      {rawError && (
        <ImageButton
          component={Copy}
          alt="Close token selector modal"
          size={10}
          onClick={() => {
            navigator.clipboard.writeText(rawError);
          }}
        />
      )}
      {msg && <ImageButton component={X} alt="Close token selector modal" size={24} onClick={handleClick} />}
    </Container>
  );
}

ToastAlert.defaultProps = {
  hash: undefined
};

const Container = styled.div`
  width: 100%;
  display: flex;
  alignitems: center;
  flexdirection: row;
  // border: 1px solid red;
`;

const Link = styled.a`
  ${LinksTextLink}
  letter-spacing: 0.02em;
  text-decoration-line: underline;
  color: #000000;
`;

const Text = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 2;
`;

const Title = styled.div`
  ${BodyCaps}
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const MessageContainer = styled.div`
  ${BodyS}
  wordbreak: break-all;
  :first-letter: {
    texttransform: capitalize;
  }
`;
