import React from "react";
import styled from "styled-components";
import BrendanTwitterPFP from "src/assets/images/brendan-twitter-pfp.png";
import ClockIcon from "src/assets/images/clock-icon.svg";
import BeanstalkFarmsLogo from "src/assets/images/beanstalk-farms.png";

import { Table, Td, THead, ResponsiveTr, Th, TBody, Row } from "src/components//Table";
import { Link } from "react-router-dom";
import { theme } from "src/utils/ui/theme";
import { Text } from "src/components/Typography";

type ComponentDetail = {
  component: {
    name: string;
    description: string;
    url?: string;
  };
  type: {
    type: string;
    imgSrc?: string;
  };
  dev: {
    name: string;
    imgSrc: string;
    url?: string;
  };
};
const componentsDetail: ComponentDetail[] = [
  {
    component: {
      name: "Multi Flow",
      description: "An inter-block MEV manipulation resistant oracle implementation.",
      url: "https://docs.basin.exchange/implementations/multi-flow-pump"
    },
    type: {
      type: "🔮 Pump"
    },
    dev: {
      name: "Brendan Sanderson",
      imgSrc: BrendanTwitterPFP,
      url: "https://twitter.com/brendaann__"
    }
  },
  {
    component: {
      name: "Constant Product 2",
      description: "A standard x*y = k token pricing function for two tokens with no fees.",
      url: "https://github.com/BeanstalkFarms/Basin/blob/master/src/functions/ConstantProduct2.sol"
    },
    type: {
      type: "Well Function",
      imgSrc: ClockIcon
    },
    dev: {
      name: "Beanstalk Farms",
      imgSrc: BeanstalkFarmsLogo
    }
  },
  {
    component: {
      name: "Well.sol",
      description: "A standard Well implementation that prioritizes flexibility and composability.",
      url: "https://github.com/BeanstalkFarms/Basin/blob/master/src/Well.sol"
    },
    type: {
      type: "💧 Well Implementation",
      imgSrc: ""
    },
    dev: {
      name: "Beanstalk Farms",
      imgSrc: BeanstalkFarmsLogo
    }
  }
] as const;

export const ComponentLibraryTable = () => {
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
        {componentsDetail.map(({ component, type, dev }, i) => (
          <StyledTr key={`${component.name}-${i}`}>
            <TableData align="left" url={component.url}>
              <Text $variant="l">{component.name}</Text>
              <Text $color="text.secondary">{component.description}</Text>
            </TableData>
            <TableData>
              <TextWrapper>
                {type.imgSrc && <IconImg src={type.imgSrc} />}
                <Text $variant="l">{type.type}</Text>
              </TextWrapper>
            </TableData>
            <TableData url={dev.url}>
              <TextWrapper>
                <IconImg src={dev.imgSrc} $rounded />
                <Text $variant="l">{dev.name}</Text>
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

const TableData = ({ children, url, align = "right" }: { children: React.ReactNode; align?: "left" | "right"; url?: string }) => {
  if (url) {
    return (
      <StyledTd align={align} $hasLink={!!url}>
        <StyledLink to={url}>{children}</StyledLink>
      </StyledTd>
    );
  }

  return <StyledTd align={align}>{children}</StyledTd>;
};
