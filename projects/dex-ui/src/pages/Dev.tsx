import { BeanstalkSDK, TestUtils, Token, TokenValue } from "@beanstalk/sdk";
import { ethers } from "ethers";
import React, { useState } from "react";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { Button } from "src/components/Swap/Button";
import { TokenInput } from "src/components/Swap/TokenInput";
import toast from "react-hot-toast";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import { useWellTokens } from "src/tokens/useWellTokens";
import styled from "styled-components";
import { useAccount, useProvider } from "wagmi";
import { ToastAlert } from "src/components/TxnToast/ToastAlert";
import { useWells } from "src/wells/useWells";

export const Dev = () => {
  const provider = useProvider();
  const account = useAccount();
  const { data } = useWellTokens();
  const { data: wells } = useWells();

  const [amounts, setAmounts] = useState<Map<string, TokenValue>>(new Map());
  const { refetch: refetchTokenBalances } = useAllTokensBalance();
  const sdk = new BeanstalkSDK({ provider: provider as ethers.providers.JsonRpcProvider });

  const tokens = new Set<Token>();
  for (const token of data || []) {
    tokens.add(token);
  }

  const rows = [];

  const goBalance = async (token: Token) => {
    const amount = amounts.get(token.symbol) || TokenValue.ZERO;
    const utils = new TestUtils.BlockchainUtils(sdk);
    await utils.setBalance(token, account.address || "", amount);
    await mine();
    await refetchTokenBalances();
    toast.success(<ToastAlert desc={`Set ${token.symbol} balance to  ${amount.toHuman("short")}`} />);
  };

  const clearApproval = async (token: Token) => {
    await token.approve("0xDEb0f00071497a5cc9b4A6B96068277e57A82Ae2", TokenValue.ZERO); //depot
    toast.success(<ToastAlert desc={`Revoked ${token.symbol} allowance for Depot`} />);
    for await (const well of wells || []) {
      const allowance = await token.getAllowance(account.address || "", well.address);
      if (!allowance || allowance.eq(TokenValue.ZERO)) continue;
      await token.approve(well.address, TokenValue.ZERO); //depot
      toast.success(<ToastAlert desc={`Revoked ${token.symbol} allowance for ${well.name}`} />);
    }

    mine();
  };

  const mine = async () => {
    const utils = new TestUtils.BlockchainUtils(sdk);
    await utils.mine();
    toast.success(<ToastAlert desc={`Mined a new block`} />);
  };

  for (let token of tokens) {
    rows.push(
      <Row key={token.symbol}>
        <TokenInput
          token={token}
          canChangeToken={false}
          label="token"
          loading={false}
          amount={amounts.get(token.symbol)}
          onAmountChange={(amount) => {
            setAmounts(new Map(amounts.set(token.symbol, amount)));
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

        <Button
          secondary
          onClick={() => {
            clearApproval(token);
          }}
          label={"Clear Approvals (multi tx)"}
          disabled={false}
          loading={false}
        />
      </Row>
    );
  }

  return (
    <Page>
      <Title title="Developer" />
      <span>Give yourself some tokens</span>
      <Container>{rows}</Container>
      <hr />
      <Row>
        <Button onClick={mine} label={"Mine Block"} disabled={false} loading={false} />
      </Row>
    </Page>
  );
};

const Row = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 400px;
`;

const Container = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 5px;
`;
