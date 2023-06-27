import { Well } from "@beanstalk/sdk/Wells";
import React, { useCallback, useState } from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { Row } from "../../Layout";
import { ChevronDown } from "../../Icons";
import { LiquidityChart } from "./LiquidityChart";
import { VolumeChart } from "./VolumeChart";
import { TabButton } from "src/components/TabButton";

export const ChartSection: FC<{ well: Well }> = ({ well }) => {
  const [tab, setTab] = useState(0);

  const showTab = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>, i: number) => {
    (e.target as HTMLElement).blur();
    setTab(i);
  }, []);

  return (
    <Container id="chart-section">
      <Row>
        <TabButton onClick={(e) => showTab(e, 0)} active={tab === 0}>
          LIQUIDITY
        </TabButton>
        <TabButton onClick={(e) => showTab(e, 1)} active={tab === 1}>
          VOLUME
        </TabButton>
        <FilterButton onClick={() => {}}>
          ALL <ChevronDown width={6} />
        </FilterButton>
      </Row>
      {tab === 0 && <LiquidityChart />}
      {tab === 1 && <VolumeChart />}
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  // border: 0.5px solid #9ca3af;
  outline: 0.5px solid #9ca3af;
  background-color: #f9f8f6;
`;

const FilterButton = styled(TabButton)`
  margin-left: auto;
  gap: 10px;
  outline: none;
  border-left: 0.5px solid #9ca3af;
  background-color: #fff;
`;
