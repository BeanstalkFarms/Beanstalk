import React, { useMemo } from "react";
import styled from "styled-components";

import { Table, Td, THead, ResponsiveTr, Th, TBody, Row } from "src/components//Table";
import { Link } from "react-router-dom";
import { theme } from "src/utils/ui/theme";
import { Text } from "src/components/Typography";
import { useWhitelistedWellComponents } from "./useWhitelistedWellComponents";

export const ComponentLibraryTable = () => {
  const { wellImplementations, pumps, wellFunctions } = useWhitelistedWellComponents();

  const entries = useMemo(
    () => [...pumps, ...wellFunctions, ...wellImplementations],
    [pumps, wellFunctions, wellImplementations]
  );

  return (
    <StyledTable>
      <THead>
        <ResponsiveTr>
          <Th align="left">Well Component</Th>
          <Th align="right">Type</Th>
          <Th align="right">Developer</Th>
        </ResponsiveTr>
      </THead>
      <TBody>
        {entries.map(({ component, deploy }, i) => (
          <StyledTr key={`${component.name}-${i}`}>
            <TableData align="left" url={component.url}>
              <Text $variant="l">{component.name}</Text>
              <Text $color="text.secondary">{component.summary}</Text>
            </TableData>
            <TableData>
              <TextWrapper>
                {component.type.imgSrc && <IconImg src={component.type.imgSrc} />}
                <Text $variant="l">{component.type.display}</Text>
              </TextWrapper>
            </TableData>
            <TableData url={deploy.url}>
              <TextWrapper>
                <IconImg src={deploy.imgSrc} $rounded />
                <Text $variant="l">{deploy.value}</Text>
              </TextWrapper>
            </TableData>
          </StyledTr>
        ))}
      </TBody>
    </StyledTable>
  );
};

/// Table
const StyledTable = styled(Table)`
  overflow: auto;
`;

const StyledTd = styled(Td)<{ $hasLink?: boolean }>`
  padding: unset;
  padding: ${theme.spacing(3, 2)};
  cursor: ${(props) => (props.$hasLink ? "pointer" : "default")};
`;

const StyledTr = styled(Row)`
  height: unset;
`;

const TextWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing(1)};
  cursor: inherit;
`;

const IconImg = styled.img<{ $rounded?: boolean }>`
  max-height: 24px;
  max-width: 24px;
  ${(props) => (props.$rounded ? "border-radius: 50%;" : "")}
  margin-bottom: ${theme.spacing(0.375)};
`;

const StyledLink = styled(Link).attrs({
  target: "_blank",
  rel: "noopener noreferrer"
})`
  text-decoration: none;
  color: ${theme.colors.black};
`;

const TableData = ({
  children,
  url,
  align = "right"
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  url?: string;
}) => {
  if (url) {
    return (
      <StyledTd align={align} $hasLink={!!url}>
        <StyledLink to={url}>{children}</StyledLink>
      </StyledTd>
    );
  }

  return <StyledTd align={align}>{children}</StyledTd>;
};
