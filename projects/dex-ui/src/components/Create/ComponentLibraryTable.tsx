import React from "react";
import styled from "styled-components";

import { Table, Td, THead, ResponsiveTr, Th, TBody, Row } from "src/components//Table";
import { Link } from "react-router-dom";
import { theme } from "src/utils/ui/theme";
import { Text } from "src/components/Typography";
import { useWhitelistedWellComponents } from "./useWhitelistedWellComponents";

export const ComponentLibraryTable = () => {
  const { wellImplementations, pumps, wellFunctions } = useWhitelistedWellComponents();

  const entries = [...pumps, ...wellFunctions, ...wellImplementations];

  return (
    <StyledTable>
      <THead>
        <ResponsiveTr>
          <StyledTh align="left">Well Component</StyledTh>
          <StyledTh align="right">Type</StyledTh>
          <StyledTh align="right" $hideMobile>
            Developer
          </StyledTh>
        </ResponsiveTr>
      </THead>
      <TBody>
        {entries.map(({ component, info }, i) => {
          const deployInfo = info.find((data) => data.label === "Deployed By");
          if (!deployInfo || typeof deployInfo.value !== "string") return null;

          return (
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
              <TableData url={deployInfo?.url} hideMobile>
                <TextWrapper>
                  <IconImg src={deployInfo?.imgSrc} $rounded />
                  <Text $variant="l">{deployInfo.value}</Text>
                </TextWrapper>
              </TableData>
            </StyledTr>
          );
        })}
      </TBody>
    </StyledTable>
  );
};

/// Table
const StyledTable = styled(Table)`
  overflow: auto;
`;

const StyledTh = styled(Th)<{ $hideMobile?: boolean }>`
  ${(props) =>
    props.$hideMobile &&
    `
    ${theme.media.query.sm.only} {
      display: none;
      }
  `}
`;

const StyledTd = styled(Td)<{ $hasLink?: boolean; $hideMobile?: boolean }>`
  padding: unset;
  padding: ${theme.spacing(3, 2)};
  cursor: ${(props) => (props.$hasLink ? "pointer" : "default")};
  ${(props) =>
    props.$hideMobile &&
    `
    ${theme.media.query.sm.only} {
      display: none;
      }
  `}
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
  align = "right",
  hideMobile
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  url?: string;
  hideMobile?: boolean;
}) => {
  if (url) {
    return (
      <StyledTd align={align} $hasLink={!!url} $hideMobile={hideMobile}>
        <StyledLink to={url}>{children}</StyledLink>
      </StyledTd>
    );
  }

  return (
    <StyledTd align={align} $hideMobile={hideMobile}>
      {children}
    </StyledTd>
  );
};
