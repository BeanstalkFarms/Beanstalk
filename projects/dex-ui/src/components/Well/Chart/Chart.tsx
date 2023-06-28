import React, { useEffect, useState } from "react";
import { FC } from "src/types";
import { ChartContainer } from "./ChartStyles";
import { createChart } from "lightweight-charts";
import { useRef } from "react";
import styled from "styled-components";

type Props = {
  legend: string;
  data: any;
};

function formatToUSD(value: any) {
  const formattedValue = Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  return formattedValue;
}

export const Chart: FC<Props> = ({ legend, data }) => {
  const chartContainerRef = useRef<any>();
  const chart = useRef<any>();
  const lineSeries = useRef<any>();
  const [lastDataPoint, setLastDataPoint] = useState<any>();
  const [dataPoint, setDataPoint] = useState<any>();
  const [dataPointValue, setDataPointValue] = useState<any>();

  useEffect(() => {
    if (chartContainerRef.current) {
      const chartOptions = {
        layout: {
          fontFamily: "PPMori, sans-serif"
        },
        localization: {
          priceFormatter: formatToUSD
        },
        crosshair: {
          vertLine: {
            labelBackgroundColor: "#000"
          },
          horzLine: {
            labelBackgroundColor: "#000"
          }
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false
        }
      };

      chart.current = createChart(chartContainerRef.current, chartOptions);
      lineSeries.current = chart.current.addLineSeries({ color: "#000" });
    }
  }, []);

  useEffect(() => {
    lineSeries.current.setData(data);
    chart.current.timeScale().fitContent();
    setLastDataPoint(data[data.length - 1] && data[data.length - 1].value ? data[data.length - 1].value : null);
    chart.current.subscribeCrosshairMove((param: any) => setDataPoint(param.seriesData.get(lineSeries.current) || null));

    return () => {
      chart.current.unsubscribeCrosshairMove();
    };
  }, [data, lastDataPoint]);

  useEffect(() => {
    setDataPointValue(dataPoint && dataPoint.value ? dataPoint.value : null);
  }, [dataPoint]);

  return (
    <ChartContainer ref={chartContainerRef} id="container">
      <Legend>
        <div>{legend}</div>
        <LegendValue>{formatToUSD(dataPointValue || lastDataPoint || 0)}</LegendValue>
      </Legend>
    </ChartContainer>
  );
};

const Legend = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  margin-top: 24px;
  margin-left: 24px;
  z-index: 3;
  font-size: 16px;
  font-family: PPMori;
  line-height: 24px;
  color: #4b5563;
`;

const LegendValue = styled.div`
  color: #1c1917;
`;
