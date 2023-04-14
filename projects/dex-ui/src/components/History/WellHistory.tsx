import React, { useEffect, useState } from "react";

import { Well } from "@beanstalk/sdk/Wells";
import useWellHistory, { EVENT_TYPE, WellEvent } from "src/wells/useWellHistory";
import styled from "styled-components";

type WellHistoryProps = {
  well: Well;
};

enum WellEventFilter {
  ALL,
  SWAPS,
  DEPOSITS,
  WITHDRAWS
}

export const WellHistory = ({ well }: WellHistoryProps) => {
  const { data: events, isLoading: loading, error } = useWellHistory(well.address);
  const [data, setData] = useState<WellEvent[]>([]);
  const [filter, setFilter] = useState<WellEventFilter>(WellEventFilter.ALL);

  const getEventType = (eventType: EVENT_TYPE) => {
    if (eventType === EVENT_TYPE.ADD_LIQUIDITY) {
      return "Add Liquidity";
    }

    if (eventType === EVENT_TYPE.REMOVE_LIQUIDITY) {
      return "Remove Liquidity";
    }

    return "Swap";
  };

  const formatDollarAmount = (amount: number) =>
    amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD"
    });

  const formatTime = (timestamp: number) => {
    const currentDate = new Date();
    currentDate.setTime(timestamp * 1000);
    return currentDate.toLocaleString();
  };

  const filterData = (filterMode: WellEventFilter) => {
    setFilter(filterMode);
  };

  useEffect(() => {
    if (!events) return;
    if (filter === WellEventFilter.ALL) {
      setData(events);
    }
    if (filter === WellEventFilter.SWAPS) {
      setData(events.filter((e) => e.type === EVENT_TYPE.SWAP));
    }
    if (filter === WellEventFilter.DEPOSITS) {
      setData(events.filter((e) => e.type === EVENT_TYPE.ADD_LIQUIDITY));
    }
    if (filter === WellEventFilter.WITHDRAWS) {
      setData(events.filter((e) => e.type === EVENT_TYPE.REMOVE_LIQUIDITY));
    }
  }, [events, filter]);

  // TODO: Handle error in the UI

  return (
    <WellHistoryContainer>
      {!loading && (
        <>
          <h1>Well History</h1>
          <div>
            <button onClick={() => filterData(WellEventFilter.ALL)}>All</button>
            <button onClick={() => filterData(WellEventFilter.SWAPS)}>Swaps</button>
            <button onClick={() => filterData(WellEventFilter.DEPOSITS)}>Deposits</button>
            <button onClick={() => filterData(WellEventFilter.WITHDRAWS)}>Withdraws</button>
          </div>
          {data.length > 0 && (
            <div>
              {data.map((event) => (
                <>
                  <strong>
                    <a href={`https://etherscan.io/tx${event.hash}`}>{getEventType(event.type)}</a>
                  </strong>
                  &nbsp; | {formatDollarAmount(event.totalDollarValue)} | {event.label} | {formatTime(event.timestamp)}
                  <br />
                </>
              ))}
            </div>
          )}
        </>
      )}
    </WellHistoryContainer>
  );
};

const WellHistoryContainer = styled.div`
  width: 800px;
`;
