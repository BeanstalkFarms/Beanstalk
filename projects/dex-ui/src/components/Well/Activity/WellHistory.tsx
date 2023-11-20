import React, { ReactElement, useState } from "react";

import { Well } from "@beanstalk/sdk/Wells";
import useWellHistory, { EVENT_TYPE, WellEvent } from "src/wells/useWellHistory";
import styled from "styled-components";
import { renderEvent } from "./eventRender";
import { Row, TBody, THead, Table, Td, Th } from "src/components/Well/Table";
import { TokenValue } from "@beanstalk/sdk";
import { TabButton } from "src/components/TabButton";
import { size } from "src/breakpoints";
import { useTokenSupply } from "src/tokens/useTokenSupply";
import { LoadingTemplate } from "src/components/LoadingTemplate";

type BaseWellHistoryProps = {
  tokenPrices: (TokenValue | null)[];
  reservesUSD: TokenValue;
};

type WellHistoryProps = {
  well: Well;
} & BaseWellHistoryProps;

const WellHistoryContent = ({ well, tokenPrices, reservesUSD }: WellHistoryProps) => {
  const { data: events, isLoading: loading } = useWellHistory(well);
  const [filter, setFilter] = useState<EVENT_TYPE | null>(null);
  const eventsPerPage = 10;
  const totalEvents = events?.length || 0;
  const totalPages = Math.ceil(totalEvents / eventsPerPage);
  const [currentPage, setCurrentPage] = useState(1);
  const newestEventOnPage = eventsPerPage * currentPage - eventsPerPage;
  const oldestEventOnPage = eventsPerPage * currentPage - 1;

  const lpTokenSupply = useTokenSupply(well.lpToken!);
  const isNonEmptyWell = lpTokenSupply.totalSupply && lpTokenSupply.totalSupply.gt(0);
  const lpTokenPrice = lpTokenSupply.totalSupply && isNonEmptyWell ? reservesUSD.div(lpTokenSupply.totalSupply) : TokenValue.ZERO;

  const eventRows: JSX.Element[] = (events || [])
    .filter((e: WellEvent) => filter === null || e.type == filter)
    .map<ReactElement>(
      (e, index): any => index >= newestEventOnPage && index <= oldestEventOnPage && renderEvent(e, well, tokenPrices, lpTokenPrice)
    );

  if (loading) {
    return <WellHistorySkeleton />;
  }

  return (
    <WellHistoryContainer>
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
        <TBody>
          {eventRows.length ? (
            eventRows
          ) : (
            <>
              <NoEventsRow colSpan={4}>
                <NoEventsData>No events to show</NoEventsData>
              </NoEventsRow>
            </>
          )}
          {!loading && isNonEmptyWell ? (
            <>
              <MobilePageSelector>
                <PageSelector colSpan={2}>
                  <SelectorContainer>
                    <StyledTabButton
                      active
                      pageLimit={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)}
                    >
                      ←
                    </StyledTabButton>
                    {`Page ${currentPage} of ${totalPages}`}
                    <StyledTabButton
                      active
                      pageLimit={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage < totalPages ? currentPage + 1 : totalPages)}
                    >
                      →
                    </StyledTabButton>
                  </SelectorContainer>
                </PageSelector>
              </MobilePageSelector>
              <DesktopPageSelector>
                <PageSelector colSpan={4}>
                  <SelectorContainer>
                    <StyledTabButton
                      active
                      pageLimit={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)}
                    >
                      ←
                    </StyledTabButton>
                    {`Page ${currentPage} of ${totalPages}`}
                    <StyledTabButton
                      active
                      pageLimit={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage < totalPages ? currentPage + 1 : totalPages)}
                    >
                      →
                    </StyledTabButton>
                  </SelectorContainer>
                </PageSelector>
              </DesktopPageSelector>
            </>
          ) : null}
        </TBody>
      </Table>
    </WellHistoryContainer>
  );
};

const WellHistorySkeleton = () => (
  <WellHistoryContainer>
    <Table width="100%">
      <THead>
        <Row>
          <Th>{""}</Th>
          <DesktopOnlyTh align={"right"}>{""}</DesktopOnlyTh>
          <DesktopOnlyTh align={"right"}>{""}</DesktopOnlyTh>
          <Th align={"right"}>{""}</Th>
        </Row>
      </THead>
      <TBody>
        <>
          {Array(10)
            .fill(null)
            .map((_, rowIdx) => (
              <LoadingRow key={`table-row-${rowIdx}`}>
                <Td>
                  <LoadingTemplate.Flex>
                    <LoadingTemplate.Item width={75} />
                  </LoadingTemplate.Flex>
                </Td>
                <DesktopOnlyTd align={"right"}>
                  <LoadingTemplate alignItems="flex-end">
                    <LoadingTemplate.Item width={75} />
                  </LoadingTemplate>
                </DesktopOnlyTd>
                <DesktopOnlyTd align={"right"}>
                  <LoadingTemplate alignItems="flex-end">
                    <LoadingTemplate.Item width={75} />
                  </LoadingTemplate>
                </DesktopOnlyTd>
                <Td align={"right"}>
                  <LoadingTemplate alignItems="flex-end">
                    <LoadingTemplate.Item width={75} />
                  </LoadingTemplate>
                </Td>
              </LoadingRow>
            ))}
        </>
      </TBody>
    </Table>
  </WellHistoryContainer>
);

export const WellHistory: React.FC<BaseWellHistoryProps & { well: Well | undefined; loading?: boolean }> = (props) => {
  if (props.loading || !props.well) {
    return <WellHistorySkeleton />;
  }

  return <WellHistoryContent well={props.well} tokenPrices={props.tokenPrices} reservesUSD={props.reservesUSD} />;
};

const DesktopOnlyTd = styled(Td)`
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const WellHistoryContainer = styled.div`
  display: flex;
`;

const DesktopOnlyTh = styled(Th)`
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const MobilePageSelector = styled(Row)`
  height: 40px;
  @media (min-width: ${size.mobile}) {
    display: none;
  }
`;

const DesktopPageSelector = styled(Row)`
  height: 48px;
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const SelectorContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: right;
  align-items: center;
  font-weight: 600;
  gap: 8px;
  background-color: #f9f8f6;
`;

const StyledTabButton = styled(TabButton)<{ pageLimit: boolean }>`
  background-color: #f9f8f6;
  outline: 0px;
  ${({ pageLimit }) => pageLimit && "color: #9CA3AF;"}
`;

const PageSelector = styled(Td)`
  padding: 0px;
  text-align: end;
`;

const NoEventsRow = styled.td`
  background-color: #fff;
  height: 120px;
  border-bottom: 0.5px solid #9ca3af;
`;

const NoEventsData = styled.div`
  display: flex;
  justify-content: center;
  color: #4b5563;

  @media (max-width: ${size.mobile}) {
    font-size: 14px;
  }
`;

const LoadingRow = styled(Row)`
  :hover {
    cursor: default;
  }
`;
