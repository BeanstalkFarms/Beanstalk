import React, { ReactElement, useEffect, useState } from "react";

import { Well } from "@beanstalk/sdk/Wells";
import useWellHistory, { EVENT_TYPE, WellEvent } from "src/wells/useWellHistory";
import styled from "styled-components";
import { renderEvent } from "./eventRender";
import { Row, TBody, THead, Table, Th } from "src/components/Well/Table";

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
          {/* <div>
            <button onClick={() => setFilter(null)}>All</button>
            <button onClick={() => setFilter(EVENT_TYPE.SWAP)}>Swaps</button>
            <button onClick={() => setFilter(EVENT_TYPE.ADD_LIQUIDITY)}>Deposits</button>
            <button onClick={() => setFilter(EVENT_TYPE.REMOVE_LIQUIDITY)}>Withdraws</button>
          </div> */}
          <Table width="100%">
            <THead>
              <Row>
                <Th>Action</Th>
                <Th>Value</Th>
                <Th>Description</Th>
                <Th>Time</Th>
              </Row>
            </THead>
            <TBody>{eventRows}</TBody>
          </Table>
        </>
      )}
    </WellHistoryContainer>
  );
};

const WellHistoryContainer = styled.div`
  display: flex;
`;
