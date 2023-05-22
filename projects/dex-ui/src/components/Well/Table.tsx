/**
 * These table styles are for the tables on the Well detail page,
 * in Activity and Other
 */
import styled from "styled-components";
import { BodyCaps, BodyS } from "../Typography";

export const Table = styled.table`
  border: 0.5px solid #000;
  border-collapse: collapse;
`;
export const Row = styled.tr`
  background-color: #fff;
  height: 48px;
  border-bottom: 0.5px solid #000;
  ${BodyS}

  :hover {
    cursor: pointer;
    background-color: #f0fdf4;
  }
`;
export const THead = styled.thead`
  ${Row} {
    height: 48px;
    background-color: #f9f8f6;
    border-bottom: 0.5px solid #000;
  }
`;

export const Th = styled.th`
  padding: 12px 24px;
  ${BodyCaps}
  color: #4B5563;
  text-align: ${(props) => props.align || "left"};
`;
export const Td = styled.td`
  padding: 16px;
  text-align: ${(props) => props.align || "left"};
`;

export const TBody = styled.tbody``;
