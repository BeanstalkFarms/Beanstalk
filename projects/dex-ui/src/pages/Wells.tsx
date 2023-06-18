import { TokenValue } from "@beanstalk/sdk";
import React, { ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { Row, TBody, THead, Table, Td, Th } from "src/components/Table";
import { TokenLogo } from "src/components/TokenLogo";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";
import styled from "styled-components";

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const navigate = useNavigate();
  const sdk = useSdk();
  const [wellLiquidity, setWellLiquidity] = useState<any>([]);
  const [wellFunctionNames, setWellFunctionNames] = useState<string[]>([])

  useMemo(() => {
    const run = async() => {
      if (!wells || !wells.length) return;
      let _wellsLiquidityUSD = []
      for (let i = 0; i < wells.length; i++) {
        if (!wells[i].tokens) return;
        const _tokenPrices = await Promise.all(wells[i].tokens!.map((token) => getPrice(token, sdk)));
        const _reserveValues = wells[i].reserves?.map((tokenReserve, index) => tokenReserve.mul(_tokenPrices[index] as TokenValue || TokenValue.ZERO));
        let initialValue = TokenValue.ZERO;
        const _totalWellLiquidity = _reserveValues?.reduce((accumulator, currentValue) => currentValue.add(accumulator), initialValue)

        _wellsLiquidityUSD[i] = _totalWellLiquidity
      }
      setWellLiquidity(_wellsLiquidityUSD)

      let _wellsFunctionNames = []
      for (let i = 0; i < wells.length; i++) {
        const _wellName = await wells[i].wellFunction!.contract.name()
        _wellsFunctionNames[i] = _wellName
      }
      setWellFunctionNames(_wellsFunctionNames)

    }

    run();
  }, [sdk, wells])



  if (isLoading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;



  const rows = wells?.map((well, index) => {
    const tokens = well.tokens || [];
    const logos: ReactNode[] = [];
    const symbols: string[] = [];
    const gotoWell = () => navigate(`/wells/${well.address}`);

    tokens.map((token) => {
      logos.push(<TokenLogo token={token} size={25} key={token.symbol} />);
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
          <DataText>{wellFunctionNames[index] ? wellFunctionNames[index] : "Price Function"}</DataText>
        </Td>
        <Td>
          <DataText>pump</DataText>
        </Td>
        <Td align="right">
          <Amount>${wellLiquidity[index] ? wellLiquidity[index].toHuman("0,0.00") : "-.--"}</Amount>
        </Td>
      </Row>
    );
  });

  return (
    <Page>
      <Title title="Liquidity" />

      <Table>
        <THead>
          <Row>
            <Th>Well Name and Details</Th>
            <Th>Pricing Function</Th>
            <Th>Pump(s)</Th>
            <Th align="right">Total Liquidity</Th>
          </Row>
        </THead>
        <TBody>{rows}</TBody>
      </Table>
    </Page>
  );
};

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