import { Well } from "@beanstalk/sdk/Wells";
import React, { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Title } from "src/components/PageComponents/Title";
import { Row, TBody, THead, Table, Td, Th, Tr } from "src/components/Table";
import { TokenLogo } from "src/components/TokenLogo";
import { H1 } from "src/components/Typography";
import { useWells } from "src/wells/useWells";
import styled from "styled-components";

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const navigate = useNavigate();
  if (isLoading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;

  const rows = wells?.map((well) => {
    const tokens = well.tokens || [];
    const logos: ReactNode[] = [];
    const symbols: string[] = [];
    const gotoWell = () => navigate(`/wells/${well.address}`);

    tokens.map((token) => {
      logos.push(<TokenLogo token={token} size={25} />);
      symbols.push(token.symbol);
    });

    return (
      <Row key={well.address} onClick={gotoWell}>
        <Td>
          <WellDetail>
            <TokenLogos>{logos}</TokenLogos>
            <TokenSymbols>{symbols.join("/")}</TokenSymbols>
            {/* <Deployer>{deployer}</Deployer> */}
          </WellDetail>
        </Td>
        <Td>
          <DataText>price function</DataText>
        </Td>
        <Td>
          <DataText>pump</DataText>
        </Td>
        <Td align="right">
          <Amount>$100,000</Amount>
        </Td>
      </Row>
    );
  });

  return (
    <Container>
      <Title title="Liquidity"/>

      <Table>
        <THead>
          <Th>Pool Name and Details</Th>
          <Th>Pricing Function</Th>
          <Th>Pump(s)</Th>
          <Th align="right">Total Liquidity</Th>
        </THead>
        <TBody>{rows}</TBody>
      </Table>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const WellDetail = styled.div``;
const TokenLogos = styled.div`
  display: flex;

  div:not(:first-child) {
    margin-left: -8px;
  }
`;
const TokenSymbols = styled.div`
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #1c1917;
`;

const Amount = styled.div`
  font-weight: 500;
  font-size: 24px;
  line-height: 30px;
  color: #1c1917;
`;

const DataText = styled.div`
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
  color: #9ca3af;
  text-transform: uppercase;
`;

const Deployer = styled.div`
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;

  color: #1c1917;
  text-transform: uppercase;
`;
