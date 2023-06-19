import { TokenValue } from "@beanstalk/sdk";
import React, { ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Item } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { TabButton } from "src/components/TabButton";
import { Row, TBody, THead, Table, Td, Th } from "src/components/Table";
import { Row as TabRow } from "src/components/Layout";
import { TokenLogo } from "src/components/TokenLogo";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";
import styled from "styled-components";
import { useAccount } from "wagmi";

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const navigate = useNavigate();
  const sdk = useSdk();
  const { address } = useAccount();
  const [wellLiquidity, setWellLiquidity] = useState<any>([]);
  const [wellFunctionNames, setWellFunctionNames] = useState<string[]>([])
  const [wellLpBalances, setWellLpBalances] = useState<any>([])
  const [tab, showTab] = useState<number>(0)
  
  useMemo(() => {
    const run = async() => {
      if (!wells || !wells.length) return;
      let _wellsLiquidityUSD = [];
      for (let i = 0; i < wells.length; i++) {
        if (!wells[i].tokens) return;
        const _tokenPrices = await Promise.all(wells[i].tokens!.map((token) => getPrice(token, sdk)));
        const _reserveValues = wells[i].reserves?.map((tokenReserve, index) => tokenReserve.mul(_tokenPrices[index] as TokenValue || TokenValue.ZERO));
        let initialValue = TokenValue.ZERO;
        const _totalWellLiquidity = _reserveValues?.reduce((accumulator, currentValue) => currentValue.add(accumulator), initialValue);

        _wellsLiquidityUSD[i] = _totalWellLiquidity;
      }
      setWellLiquidity(_wellsLiquidityUSD);

      let _wellsFunctionNames = [];
      for (let i = 0; i < wells.length; i++) {
        const _wellName = await wells[i].wellFunction!.contract.name();
        _wellsFunctionNames[i] = _wellName;
      }
      setWellFunctionNames(_wellsFunctionNames);

      let _wellsLpBalances = [];
      for (let i = 0; i < wells.length; i++) {
        if (!address || !wells[i].lpToken) return;
        const _lpBalance = await wells[i].lpToken?.getBalance(address);
        _wellsLpBalances[i] = _lpBalance;
      }
      setWellLpBalances(_wellsLpBalances);
    }

    run();
  }, [sdk, wells, address]);

  if (isLoading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;

  function WellRow(well: any, index: any) {
    if (!well) return;
    const tokens = well.tokens || [];
    const logos: ReactNode[] = [];
    const symbols: string[] = [];
    const gotoWell = () => navigate(`/wells/${well.address}`);

    tokens.map((token: any) => {
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
          <WellPricing>{wellFunctionNames[index] ? wellFunctionNames[index] : "Price Function"}</WellPricing>
        </Td>
        <Td align="right">
          <TradingFee>0.00%</TradingFee>
        </Td>
        <Td align="right">
          <Amount>${wellLiquidity[index] ? wellLiquidity[index].toHuman("0,0.00") : "-.--"}</Amount>
        </Td>
        <Td align="right">
          <Reserves>{logos[0]}{well.reserves![0] ? well.reserves![0].toHuman("0,0.00") : "-.--"}</Reserves>
          <Reserves>{logos[1]}{well.reserves![1] ? well.reserves![1].toHuman("0,0.00") : "-.--"}</Reserves>
          {well.reserves && well.reserves.length > 2 ? 
          <MoreReserves>{`+ ${well.reserves.length - 2} MORE`}</MoreReserves>
          : null }
        </Td>
      </Row>
    )
  };

  function MyLPsRow(well: any, index: any) {
    if (!well || !wellLpBalances || !wellLpBalances[index] || wellLpBalances[index].eq(TokenValue.ZERO)) return;
    const tokens = well.tokens || [];
    const logos: ReactNode[] = [];
    const symbols: string[] = [];
    const gotoWell = () => navigate(`/wells/${well.address}`);

    tokens.map((token: any) => {
      logos.push(<TokenLogo token={token} size={25} key={token.symbol} />);
      symbols.push(token.symbol);
    });

    return (
      <Row key={well.address} onClick={gotoWell}>
        <Td>
          <WellDetail>
            <TokenLogos>{logos}</TokenLogos>
            <TokenSymbols>{symbols.join("/")}</TokenSymbols>
          </WellDetail>
        </Td>
        <Td align="right">
          <div>{`${wellLpBalances[index].toHuman()} ${well.lpToken.symbol}`}</div>
        </Td>
      </Row>
    )
  };

  const rows = wells?.map((well, index) => { return tab === 0 ? WellRow(well, index) : MyLPsRow(well, index) })

  const anyLpPositions = rows.every((row) => row !== undefined)

  return (
    <Page>
      <Title title="WELLS" />
      <TabRow gap={24}>
        <Item stretch>
          <TabButton onClick={() => showTab(0)} active={tab === 0} stretch bold justify>
            <span>View Wells</span>
          </TabButton>
        </Item>
        <Item stretch>
          <TabButton onClick={() => showTab(1)} active={tab === 1} stretch bold justify>
            <span>My Liquidity Positions</span>
          </TabButton>
        </Item>
      </TabRow>
      <Table>
        {tab === 0 ?
        <THead>
          <Row>
            <Th>Well</Th>
            <Th>Well Pricing Function</Th>
            <Th align="right">Trading Fees</Th>
            <Th align="right">Total Liquidity</Th>
            <Th align="right">Reserves</Th>
          </Row>
        </THead>
        : 
        <THead>
          <Row>
            <Th>My Positions</Th>
            <Th align="right">My Liquidity</Th>
          </Row>
        </THead>
        }
        <TBody>
          {!anyLpPositions && tab === 1 ? 
            <NoLPRow colSpan={2}><NoLPMessage>Liquidity Positions will appear here.</NoLPMessage></NoLPRow>
            :
            rows
          }
        </TBody>
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
  font-size: 20px;
  line-height: 24px;
  color: #1c1917;
`;

const Amount = styled.div`
  font-weight: 500;
  font-size: 20px;
  line-height: 24px;
  color: #1c1917;
`;

const Reserves = styled.div`
  display: flex;
  flex-direction: row;
  justify-content flex-end;
  gap: 8px;
  flex: 1;
`;

const MoreReserves = styled.div`
  color: #9CA3AF;
`;

const TradingFee = styled.div`
  font-size: 16px;
  line-height: 24px;
  color: #4B5563;
  text-transform: uppercase;
`;

const WellPricing = styled.div`
  font-size: 16px;
  line-height: 24px;
  text-transform: capitalize;
`;

const NoLPRow = styled.td`
  background-color: #fff;
  height: 120px;
  border-bottom: 0.5px solid #9CA3AF;
`;

const NoLPMessage = styled.div`
  display: flex;
  justify-content: center;
  color: #4B5563;
`