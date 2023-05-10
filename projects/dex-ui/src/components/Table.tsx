import styled from "styled-components";

export const Table = styled.table`
  border: 0.5px solid #000;
  border-collapse: collapse;
`;

export const Row = styled.tr`
  background-color: #fff;
  height: 120px;
  border-bottom: 0.5px solid #000;

  :hover {
    cursor: pointer;
    background-color: #F0FDF4;
  }
`;
export const Th = styled.th`
  padding: 16px;
  border-right: 0.5px solid #000;
  color: #4b5563;
  font-weight: 400;
  font-size: 16px;
  line-height: 17px;
  text-align: ${(props) => props.align || "left"};
`;
export const Td = styled.td`
  padding: 16px;
  border-right: 0.5px solid #000;
  text-align: ${(props) => props.align || "left"};
`;
export const THead = styled.thead`
  background-color: #f9f9f9;
  border-bottom: 0.5px solid #000;
`;
export const TBody = styled.tbody``;
