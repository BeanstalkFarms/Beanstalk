import React from "react";
import { FC } from "src/types";
import { Row, TBody, THead, Table, Th, Td } from "./Table";

type Props = {};
export const OtherSection: FC<Props> = ({}) => {
  return (
    <div>
      {" "}
      <Table width="100%">
        <THead>
          <Row>
            <Th>Detail</Th>
            <Th>Value</Th>
          </Row>
        </THead>
        <TBody>
          <Row>
            <Td>Pump</Td>
            <Td>
              <span role="img" aria-label="glass globe emoji">
                🔮
              </span>{" "}
              GeoEMAandCumSMAPump
            </Td>
          </Row>
          <Row>
            <Td>Well Address</Td>
            <Td>xxx</Td>
          </Row>
          <Row>
            <Td>Token 1 Address</Td>
            <Td>xxx</Td>
          </Row>
          <Row>
            <Td>ETC...</Td>
            <Td>xxx</Td>
          </Row>
        </TBody>
      </Table>
    </div>
  );
};
