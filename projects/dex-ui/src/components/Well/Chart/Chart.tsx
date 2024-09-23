import React, { useEffect, useMemo, useState } from "react";
import { useRef } from "react";

import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import styled from "styled-components";

import { FC } from "src/types";

import { IChartDataItem } from "./ChartSection";
import { ChartContainer } from "./ChartStyles";

type Props = {
  legend: string;
  data: IChartDataItem[];
  refetching?: boolean;
};

type ChartData = {
  value: number;
  time: Time;
};

function formatToUSD(value: any) {
  const formattedValue = Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value
  );
  return formattedValue;
}

function mapChartData(data: IChartDataItem[]) {
  return data.map(({ time, value }) => ({
    time: time as Time,
    value: parseFloat(value)
  }));
}

export const Chart: FC<Props> = ({ legend, data: _data }) => {
  const chartContainerRef = useRef<any>();
  const chart = useRef<IChartApi>();
  const lineSeries = useRef<ISeriesApi<"Line">>();
  const [lastDataPoint, setLastDataPoint] = useState<ChartData | null>(null);
  const [dataPoint, setDataPoint] = useState<any>();
  const [dataPointValue, setDataPointValue] = useState<any>();

  const data = useMemo(() => mapChartData(_data), [_data]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

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
        secondsVisible: false,
        minBarSpacing: 0.01 // allow for zooming out
      }
    };

    const handleResize = () => {
      chart.current?.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight
      });
    };

    chart.current = createChart(chartContainerRef.current, chartOptions);
    lineSeries.current = chart.current.addLineSeries({ color: "#000", lineWidth: 2 });

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.current?.remove();
    };
  }, []);

  useEffect(() => {
    lineSeries.current?.setData(data);
    let lastData = null;
    let firstData = null;

    if (data.length) {
      lastData = data[data.length - 1];
      firstData = data[0];
    }
    if (!lastData || !firstData) {
      chart.current?.timeScale().fitContent();
    } else {
      chart.current?.timeScale().setVisibleRange({
        from: 0 as Time,
        to: lastData.time
      });
    }

    const handleSubscribeCrosshairMove = (param: any) => {
      setDataPoint(param.seriesData.get(lineSeries.current) || null);
    };

    setLastDataPoint(lastData);
    chart.current?.subscribeCrosshairMove(handleSubscribeCrosshairMove);

    return () => {
      chart.current?.unsubscribeCrosshairMove(handleSubscribeCrosshairMove);
    };
  }, [data]);

  useEffect(() => {
    setDataPointValue(dataPoint && dataPoint.value ? dataPoint.value : null);
  }, [dataPoint]);

  return (
    <ChartContainer ref={chartContainerRef} id="container">
      <Legend>
        <div>{legend}</div>
        <LegendValue>{formatToUSD(dataPointValue || lastDataPoint?.value || 0)}</LegendValue>
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
