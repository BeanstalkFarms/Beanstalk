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
            <Th>Value</Th>
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
            <Td><Detail>Well Address</Detail></Td>
            <Td><Link href={`https://etherscan.io/address/${well.address}`}>{well.address}</Link></Td>
          </Row>
          {well.tokens!.map(function(token, index) {
              return (
              <Row key={token.address}>
                <Td><Detail>{`Token ${index + 1} Address`}</Detail></Td>
                <Td><Link href={token ? `https://etherscan.io/address/${token.address}` : `https://etherscan.io/`}>{token.address || `-`}</Link></Td>
              </Row>
              )
            }
          )}
        </TBody>
      </Table>
    </div>
  );
};

const Detail = styled.span`
  color: #4B5563;
  font-weight: 600; 
`

const Link = styled.a`
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 0.5px;

  :link {
    color: black;
  }
`
