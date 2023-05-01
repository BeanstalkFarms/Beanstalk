import React, { ReactElement, useEffect, useState } from "react";

import { Well } from "@beanstalk/sdk/Wells";
import useWellHistory, { EVENT_TYPE, WellEvent } from "src/wells/useWellHistory";
import styled from "styled-components";
import { renderEvent } from "./eventRender";

type WellHistoryProps = {
  well: Well;
};

export const WellHistory = ({ well }: WellHistoryProps) => {
  const { data: events, isLoading: loading, error } = useWellHistory(well);
  const [filter, setFilter] = useState<EVENT_TYPE | null>(null);

  const eventRows: JSX.Element[] = (events || [])
    .filter((e: WellEvent) => filter === null || e.type == filter)
    .map<ReactElement>((e): JSX.Element => renderEvent(e, well));

  return (
    <WellHistoryContainer>
      {!loading && (
        <>
          <h1>Well History</h1>
          <div>
            <button onClick={() => setFilter(null)}>All</button>
            <button onClick={() => setFilter(EVENT_TYPE.SWAP)}>Swaps</button>
            <button onClick={() => setFilter(EVENT_TYPE.ADD_LIQUIDITY)}>Deposits</button>
            <button onClick={() => setFilter(EVENT_TYPE.REMOVE_LIQUIDITY)}>Withdraws</button>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>{eventRows}</tbody>
          </Table>
        </>
      )}
    </WellHistoryContainer>
  );
};

const WellHistoryContainer = styled.div`
  width: 800px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  border: 0px;
  & thead {
    background: #1b1e2b;
    height: ;
  }
  & td,
  th {
    padding: 15px 0px;
  }

  & th {
    text-align: left;
  }
`;
