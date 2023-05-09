import React, { useCallback } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { ImageButton } from "src/components/ImageButton";
import copyIcon from "src/assets/images/copy.svg";
import x from "src/assets/images/x.svg";

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
      <div>
        <span>
          {desc}
          {hash && (
            <>
              &nbsp;
              <Link to={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">
                View on Etherscan
              </Link>
            </>
          )}
        </span>
        {msg && <MessageContainer>{msg}</MessageContainer>}
      </div>
      {rawError && (
        <ImageButton
          src={copyIcon}
          alt="Close token selector modal"
          size={10}
          onClick={() => {
            navigator.clipboard.writeText(rawError);
          }}
        />
      )}
      {msg && <ImageButton src={copyIcon} alt="Close token selector modal" size={10} onClick={handleClick} />}
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
`;

const MessageContainer = styled.div`
  wordbreak: break-all;
  :first-letter: {
    texttransform: capitalize;
  }
`;
