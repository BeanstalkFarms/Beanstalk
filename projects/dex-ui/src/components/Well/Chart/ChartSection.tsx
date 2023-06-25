import { Well } from "@beanstalk/sdk/Wells";
import React, { useCallback, useEffect, useState } from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { Row } from "../../Layout";
import { ChevronDown } from "../../Icons";
import { Chart } from "./Chart";
import { TabButton } from "src/components/TabButton";
import useWellChartData from "src/wells/useWellChartData";
import { ChartContainer } from "./ChartStyles";

export const ChartSection: FC<{ well: Well }> = ({ well }) => {
  const [tab, setTab] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [timePeriod, setTimePeriod] = useState("all");
  const [dropdownButtonText, setDropdownButtonText] = useState("ALL");

  const { data: chartData, refetch, error, isLoading } = useWellChartData(well, timePeriod);

  const [liquidityData, setLiquidityData] = useState<any[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);

  console.log("ERROR? ", error)

  useEffect(() => {
    if (!chartData) return;
    let _liquidityData: any = [];
    let _volumeData: any = [];
    for (let i = 0; i < chartData.length; i++) {
      _liquidityData.push({
        time: Number(chartData[i].lastUpdateTimestamp),
        value: Number(chartData[i].totalLiquidityUSD).toFixed(2),
      });
      _volumeData.push({
        time: Number(chartData[i].lastUpdateTimestamp),
        value: Number(chartData[i].deltaVolumeUSD).toFixed(2),
      });
    };
    setLiquidityData([..._liquidityData]);
    setVolumeData([..._volumeData]);
  }, [chartData]);

  useEffect(() => {
    refetch();
  }, [timePeriod, refetch]);

  const showTab = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>, i: number) => {
    (e.target as HTMLElement).blur();
    setTab(i);
  }, []);

  function SetChartRange(range: string) {
    setShowDropdown(false);
    setTimePeriod(range);
    if (range === "day") {
      setDropdownButtonText("1 DAY");
    } else if (range === "week") {
      setDropdownButtonText("1 WEEK");
    } else if (range === "month") {
      setDropdownButtonText("1 MONTH");
    } else {
      setDropdownButtonText("ALL");
    };
  };

  return (
    <Container id="chart-section">
      <Row>
        <TabButton onClick={(e) => showTab(e, 0)} active={tab === 0} hover>
          LIQUIDITY
        </TabButton>
        <TabButton onClick={(e) => showTab(e, 1)} active={tab === 1} hover>
          VOLUME
        </TabButton>
        <FilterButton onClick={() => {setShowDropdown(!showDropdown)}} hover>
          {dropdownButtonText} <ChevronDown width={6} />
          <Dropdown enabled={showDropdown}>
            <DropdownItem stretch hover onClick={() => {SetChartRange("day")}}>
              1 DAY
            </DropdownItem>
            <DropdownItem stretch hover onClick={() => {SetChartRange("week")}}>
              1 WEEK
            </DropdownItem>
            <DropdownItem stretch hover onClick={() => {SetChartRange("month")}}>
              1 MONTH
            </DropdownItem>
            <DropdownItem stretch hover onClick={() => {SetChartRange("all")}}>
              ALL
            </DropdownItem>
          </Dropdown>
        </FilterButton>
      </Row>
      {error !== null && <ChartLoader>{`Error Loading Chart Data :(`}</ChartLoader>}
      {isLoading && <ChartLoader>Loading Chart Data...</ChartLoader>}
      {tab === 0 && !error && !isLoading && <Chart data={liquidityData} legend={"TOTAL LIQUIDITY"} />}
      {tab === 1 && !error && !isLoading && <Chart data={volumeData} legend={"DAILY VOLUME"} />}
    </Container>
  );
};

const ChartLoader = styled(ChartContainer)`
  justify-content: center;
  align-items: center;
`

const Dropdown = styled.div<{enabled: boolean}>`
  position: absolute;
  top: 49px;
  right: 0px;
  width: 120px;
  visibility: ${ (props) => props.enabled ? 'visible' : 'hidden' };
`;

const DropdownItem = styled(TabButton)`
  margin-bottom: 0.5px;
  justify-content: right;
  background-color: #fff;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  outline: 0.5px solid #9ca3af;
  outline-offset: -0.5px;
  background-color: #F9F8F6;
`;

const FilterButton = styled(TabButton)`
  margin-left: auto;
  gap: 10px;
  padding: 16px 16px;
  background-color: #fff;
  position: relative;
`;
