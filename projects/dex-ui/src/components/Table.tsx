import styled from "styled-components";

export const Table = styled.table`
  border: 0.5px solid #9ca3af;
  border-collapse: collapse;
  table-layout: fixed;
  overflow: hidden;
  width: 100%;
`;

export const Row = styled.tr`
  background-color: #fff;
  height: 120px;
  border-bottom: 0.5px solid #9ca3af;

  :hover {
    cursor: pointer;
    background-color: #f0fdf4;
  }
`;
export const Th = styled.th`
  padding: 16px;
  color: #4b5563;
  font-weight: 400;
  font-size: 16px;
  line-height: 16px;
  text-align: ${(props) => props.align || "left"};
  text-transform: uppercase;
  cursor: default;
`;
export const Td = styled.td`
  padding: 16px;
  text-align: ${(props) => props.align || "left"};
`;
export const THead = styled.thead`
  ${Row} {
    height: 48px;
    background-color: #f9f9f9;
    border-bottom: 0.5px solid #9ca3af;
  }
`;
export const TBody = styled.tbody``;
