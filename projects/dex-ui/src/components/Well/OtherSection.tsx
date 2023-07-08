import React from "react";
import { FC } from "src/types";
import { Row, TBody, THead, Table, Th, Td } from "./Table";
import { Well } from "@beanstalk/sdk/Wells";
import styled from "styled-components";

type Props = {
  well: Well;
};

export const OtherSection: FC<Props> = ({ well }) => {
  return (
    <div>
      <Table width="100%">
        <THead>
          <Row>
            <Th>Detail</Th>
            <DesktopTh>Value</DesktopTh>
            <MobileTh align={"right"}>Value</MobileTh>
          </Row>
        </THead>
        <TBody>
          {/*<Row>
            <Td>Pump</Td>
            <Td>
              <span role="img" aria-label="glass globe emoji">
                🔮
              </span>{" "}
              GeoEMAandCumSMAPump
            </Td>
            </Row>*/}
          <Row>
            <Td>
              <Detail>Well Address</Detail>
            </Td>
            <DesktopTd>
              <Link href={`https://etherscan.io/address/${well.address}`}>{well.address}</Link>
            </DesktopTd>
            <MobileTd align={"right"}>
              <Link href={`https://etherscan.io/address/${well.address}`}>{well.address.substr(0, 5)+'...'+well.address.substr(well.address.length - 5)}</Link>
            </MobileTd>
          </Row>
          {well.tokens!.map(function (token, index) {
            return (
              <Row key={token.address}>
                <Td>
                  <Detail>{`Token ${index + 1} Address`}</Detail>
                </Td>
                <DesktopTd>
                  <Link href={token ? `https://etherscan.io/address/${token.address}` : `https://etherscan.io/`}>
                    {token.address || `-`}
                  </Link>
                </DesktopTd>
                <MobileTd align={"right"}>
                  <Link href={token ? `https://etherscan.io/address/${token.address}` : `https://etherscan.io/`}>
                    {token.address.substr(0, 5)+'...'+token.address.substr(token.address.length - 5) || `-`}
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

const Detail = styled.span`
  color: #4b5563;
  font-weight: 600;
`;

const Link = styled.a`
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 0.5px;

  :link {
    color: black;
  }
`;

const DesktopTd = styled(Td)`
  @media (max-width: 475px) {
    display: none;
  }
`

const MobileTd = styled(Td)`
  @media (min-width: 475px) {
    display: none;
  }
`

const DesktopTh = styled(Th)`
  @media (max-width: 475px) {
    display: none;
  }
`

const MobileTh = styled(Th)`
  @media (min-width: 475px) {
    display: none;
  }
`