import React, { ReactElement, useState } from "react";

import { Well } from "@beanstalk/sdk/Wells";
import useWellHistory, { EVENT_TYPE, WellEvent } from "src/wells/useWellHistory";
import styled from "styled-components";
import { renderEvent } from "./eventRender";
import { Row, TBody, THead, Table, Th } from "src/components/Well/Table";
import { TokenValue } from "@beanstalk/sdk";

type WellHistoryProps = {
  well: Well;
  tokenPrices: (TokenValue | null)[];
};

export const WellHistory = ({ well, tokenPrices }: WellHistoryProps) => {
  const { data: events, isLoading: loading } = useWellHistory(well);
  const [filter, setFilter] = useState<EVENT_TYPE | null>(null);

  const eventRows: JSX.Element[] = (events || [])
    .filter((e: WellEvent) => filter === null || e.type == filter)
    .map<ReactElement>((e): JSX.Element => renderEvent(e, well, tokenPrices));

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
                <DesktopOnlyTh align={"right"}>Value</DesktopOnlyTh>
                <DesktopOnlyTh align={"right"}>Description</DesktopOnlyTh>
                <Th align={"right"}>Time</Th>
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

const DesktopOnlyTh = styled(Th)`
  @media (max-width: 475px) {
    display: none;
  }
`;
