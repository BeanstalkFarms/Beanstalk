import { TestUtils, Token, TokenValue } from "@beanstalk/sdk";
import React, { useEffect, useState } from "react";
import { Button } from "src/components/Swap/Button";
import { TokenInput } from "src/components/Swap/TokenInput";
import { useWellTokens } from "src/tokens/useWellTokens";
import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";
import styled from "styled-components";
import { useAccount } from "wagmi";

export const Dev = () => {
  const [balances, setBalances] = useState<Record<string, TokenValue>>({});
  const [b, setB] = useState<any>();
  const sdk = useSdk();
  const account = useAccount();

  const { data } = useWellTokens();

  const rows = [];
  console.log("Fuck:", balances);

  const goBalance = async (token: Token) => {
    const amount = balances[token.symbol] || TokenValue.ZERO;
    const utils = new TestUtils.BlockchainUtils(sdk);
    await utils.setBalance(token, account.address || "", amount);
    alert(`Set balance to ${amount.toHuman()}`);
  };

  for (let token of data || []) {
    rows.push(
      <Row key={token.symbol}>
        <TokenInput
          token={token}
          canChangeToken={false}
          label="token"
          loading={false}
          // amount={balances[token.symbol]}
          amount={b}
          onAmountChange={(amount) => {
            balances[token.symbol] = amount;
            console.log(balances);
            setBalances(balances);
            setB(amount);
          }}
        />

        <Button
          onClick={() => {
            goBalance(token);
          }}
          label={"Set Balance"}
          disabled={false}
          loading={false}
        />
      </Row>
    );
  }

  return <div>{rows}</div>;
};

const Row = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;
