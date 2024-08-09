import React, { useEffect, useState } from "react";
import { FC } from "src/types";
import { Row, TBody, THead, Table, Td, Th } from "./Table";
import { Well } from "@beanstalk/sdk/Wells";
import styled from "styled-components";
import { size } from "src/breakpoints";
import { displayTokenSymbol } from "src/utils/format";
import { Token } from "@beanstalk/sdk";
import { Skeleton } from "../Skeleton";
import { useWhitelistedWellComponents } from "../Create/useWhitelistedWellComponents";
import { useWellImplementations } from "src/wells/useWellImplementations";
import { getIsMultiPumpWell } from "src/wells/pump/utils";

type Props = { well: Well };

const OtherSectionContent: FC<Props> = ({ well }) => {
  const { data: implementations } = useWellImplementations();
  const {
    lookup: { pumps: pumpLookup }
  } = useWhitelistedWellComponents();

  const [items, setItems] = useState<{ name: string; address: string }[]>([]);
  const [wellFunctionName, setWellFunctionName] = useState<string>("");

  const implementationAddress = implementations?.[well.address.toLowerCase()];

  const wellTokenDetail = well.tokens
    ?.map((token) => token.symbol)
    .filter(Boolean)
    .join(":");

  useEffect(() => {
    const run = async () => {
      if (!well.wellFunction) return;
      const name = await well.wellFunction.getName();
      setWellFunctionName(name);
    };
    run();
  }, [well.wellFunction]);

  useEffect(() => {
    const data: typeof items = [];
    well.pumps?.forEach((pump) => {
      const pumpAddress = pump.address.toLowerCase();
      if (pumpAddress in pumpLookup) {
        const pumpInfo = pumpLookup[pumpAddress].component;
        data.push({
          name: pumpInfo?.fullName || pumpInfo.name,
          address: pump.address
        });
      } else if (getIsMultiPumpWell(well).isV1) {
        data.push({
          name: "Multi Flow Pump",
          address: pump.address
        });
      } else {
        data.push({
          name: "Pump",
          address: pump.address || "--"
        });
      }
    });
    data.push({
      name: wellFunctionName ?? "Well Function",
      address: well.wellFunction?.address || "--"
    });
    data.push({
      name: "Well Implementation",
      address: implementationAddress || "--"
    });
    data.push({
      name: "Aquifer",
      address: well.aquifer?.address || "--"
    });

    setItems(data);
  }, [
    implementationAddress,
    pumpLookup,
    well,
    wellFunctionName
  ]);

  return (
    <div>
      <Table width="100%">
        <THead>
          <Row>
            <Th>Name</Th>
            <DesktopTh align="right">Address</DesktopTh>
            <MobileTh align="right">Address</MobileTh>
          </Row>
        </THead>
        <TBody>
          <Row>
            <Td>
              <Detail>{wellTokenDetail} Well</Detail>
            </Td>
            <DesktopTd align={"right"}>
              <Link href={`https://etherscan.io/address/${well.address}`}>{well.address}</Link>
            </DesktopTd>
            <MobileTd align={"right"}>
              <Link href={`https://etherscan.io/address/${well.address}`}>
                {well.address.substr(0, 5) + "..." + well.address.substr(well.address.length - 5)}
              </Link>
            </MobileTd>
          </Row>
          <Row>
            <Td>
              <Detail>Well LP Token - {displayTokenSymbol(well.lpToken as Token)}</Detail>
            </Td>
            <DesktopTd align={"right"}>
              <Link href={`https://etherscan.io/address/${well.address}`}>{well.address}</Link>
            </DesktopTd>
            <MobileTd align={"right"}>
              <Link href={`https://etherscan.io/address/${well.address}`}>
                {well.address.substr(0, 5) + "..." + well.address.substr(well.address.length - 5)}
              </Link>
            </MobileTd>
          </Row>
          {well.tokens?.map(function (token, index) {
            return (
              <Row key={token.address}>
                <Td>
                  <Detail>{`Token ${index + 1} - ${token.symbol}`}</Detail>
                </Td>
                <DesktopTd align="right">
                  <Link
                    href={
                      token
                        ? `https://etherscan.io/address/${token.address}`
                        : `https://etherscan.io/`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {token.address || `-`}
                  </Link>
                </DesktopTd>
                <MobileTd align={"right"}>
                  <Link
                    href={
                      token
                        ? `https://etherscan.io/address/${token.address}`
                        : `https://etherscan.io/`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {token.address.substr(0, 5) +
                      "..." +
                      token.address.substr(token.address.length - 5) || `-`}
                  </Link>
                </MobileTd>
              </Row>
            );
          })}
          {items.map(function (tableItem, index) {
            return (
              <Row key={`${tableItem.address}-${index}}`}>
                <Td>
                  <Detail>{tableItem.name}</Detail>
                </Td>
                <DesktopTd align={"right"}>
                  <Link href={`https://etherscan.io/address/${tableItem.address}`}>
                    {tableItem.address}
                  </Link>
                </DesktopTd>
                <MobileTd align={"right"}>
                  <Link href={`https://etherscan.io/address/${tableItem.address}`}>
                    {tableItem.address.substr(0, 5) +
                      "..." +
                      tableItem.address.substr(tableItem.address.length - 5)}
                  </Link>
                </MobileTd>
              </Row>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
};

const loadingItemProps = {
  sm: { height: 24, width: 100 },
  lg: { height: 24, width: 200 }
};

export const OtherSection: FC<{ well: Well | undefined; loading?: boolean }> = ({
  well,
  loading
}) => {
  if (!well || loading) {
    return (
      <div>
        <Table width="100%">
          <THead>
            <Row>
              <Th>{""}</Th>
              <DesktopTh>{""}</DesktopTh>
              <MobileTh align={"right"}>{""}</MobileTh>
            </Row>
          </THead>
          <TBody>
            {Array(8)
              .fill(null)
              .map((_, idx) => (
                <LoadingRow key={`token-info-row-${idx}`}>
                  <Td>
                    <Skeleton {...loadingItemProps.sm} />
                  </Td>
                  <DesktopTd>
                    <Skeleton {...loadingItemProps.lg} />
                  </DesktopTd>
                  <MobileTd align={"right"}>
                    <Skeleton {...loadingItemProps.sm} />
                  </MobileTd>
                </LoadingRow>
              ))}
          </TBody>
        </Table>
      </div>
    );
  }
  return <OtherSectionContent well={well} />;
};

const Detail = styled.span`
  color: #4b5563;
  font-weight: 600;
`;

const Link = styled.a`
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 0.5px;
  color: black;

  :link {
    color: black;
  }
`;

const DesktopTd = styled(Td)`
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const MobileTd = styled(Td)`
  @media (min-width: ${size.mobile}) {
    display: none;
  }
`;

const DesktopTh = styled(Th)`
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const MobileTh = styled(Th)`
  @media (min-width: ${size.mobile}) {
    display: none;
  }
`;

const LoadingRow = styled(Row)`
  :hover {
    cursor: default;
  }
`;
