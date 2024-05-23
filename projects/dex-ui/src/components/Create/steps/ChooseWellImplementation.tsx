import React, { useState } from "react";
import { Box, Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";

import { ToggleSwitch } from "src/components/ToggleSwitch";
import { ButtonPrimary } from "src/components/Button";
import { BEANETH_ADDRESS } from "src/utils/addresses";
import BeanstalkFarmsLogo from "src/assets/images/beanstalk-farms.png";
import HalbornLogo from "src/assets/images/halborn-logo.png";
import { AccordionSelectCard } from "src/components/Common/ExpandableCard";
import styled from "styled-components";
import { theme } from "src/utils/ui/theme";
import { Etherscan, Github } from "src/components/Icons";
import { Link } from "react-router-dom";

type WellInfoEntry = {
  name: string;
  description: string[];
  info: {
    label: string;
    value: string;
    imgSrc?: string;
    url?: string;
  }[];
  usedBy: number;
  etherscan?: string;
  github?: string;
  learnMore?: string;
};

// Can we make this dynamic??
const entries: Record<string, WellInfoEntry> = {
  [BEANETH_ADDRESS.toLowerCase()]: {
    name: "Well.sol",
    description: [
      "A standard Well implementation that prioritizes flexibility and composability.",
      "Fits many use cases for a Liquidity Well."
    ],
    info: [
      { label: "Deployed By", value: "Beanstalk Farms", imgSrc: BeanstalkFarmsLogo },
      { label: "Block Deployed", value: "12345678" },
      { label: "Auditor", value: "Halborn", imgSrc: HalbornLogo, url: "https://github.com/BeanstalkFarms/Beanstalk-Audits" }
    ],
    usedBy: 1,

    etherscan: "https://etherscan.io", // TODO: FIX ME
    github: "https://github.com/BeanstalkFarms/Basin/blob/master/src/Well.sol",
    learnMore: "https://docs.basin.exchange" // TODO: FIX ME
  }
};

export const ChooseWellImplementation = () => {
  const [selected, setSelected] = useState<string>("");
  const [isCustomWell, setIsCustomWell] = useState(false);

  const handleSetSelected = (addr: string) => {
    setSelected(selected === addr ? "" : addr);
  };

  return (
    <FormWrapper $gap={2}>
      <Text $lineHeight="l">Which Well Implementation do you want to use?</Text>
      {Object.entries(entries).map(([address, data], i) => (
        <AccordionSelectCard
          key={`well-implementation-card-${address}`}
          selected={selected === address}
          upper={
            <Flex $direction="row" $gap={2}>
              <Box>
                <Text $weight="semi-bold" $variant="xs">
                  {data.name}{" "}
                  <Text as="span" $color="text.secondary" $weight="normal" $variant="xs">
                    {"(Recommended)"}
                  </Text>
                </Text>
                {data.description.map((text, j) => (
                  <Text $color="text.secondary" $variant="xs" key={`description-${i}-${j}`}>
                    {text}
                  </Text>
                ))}
              </Box>
            </Flex>
          }
          below={
            <Flex $direction="row" $justifyContent="space-between">
              <Flex $gap={0.5} $alignItems="flex-start">
                {data.info.map((info) => (
                  <Text $color="text.secondary" $variant="xs" key={`info-${info.label}`}>
                    {info.label}: {info.imgSrc && <IconImg src={info.imgSrc} />}
                    <MayLink url={info.url || ""}>
                      <Text as="span" $variant="xs">
                        {" "}
                        {info.value}
                      </Text>
                    </MayLink>
                  </Text>
                ))}
                <Text $color="text.light" $variant="xs">
                  Used by {data.usedBy} other {toPlural("Well", data.usedBy)}
                </Text>
              </Flex>
              <Flex $justifyContent="space-between" $alignItems="flex-end">
                <Flex $direction="row" $gap={0.5}>
                  {data.etherscan && (
                    <MayLink url={data.etherscan}>
                      <Etherscan width={20} height={20} color={theme.colors.lightGray} />
                    </MayLink>
                  )}
                  {data.github && (
                    <MayLink url={data.github}>
                      <Github width={20} height={20} color={theme.colors.lightGray} />
                    </MayLink>
                  )}
                </Flex>
                {data.learnMore ? (
                  <MayLink url={data.learnMore}>
                    <Text $color="text.secondary" $variant="xs" $textDecoration="underline">
                      Learn more about this component
                    </Text>
                  </MayLink>
                ) : null}
              </Flex>
            </Flex>
          }
          onClick={() => handleSetSelected(address)}
          // defaultExpanded
        />
      ))}
      <Flex $direction="row" $gap={1}>
        <ToggleSwitch checked={isCustomWell} toggle={() => setIsCustomWell((prev) => !prev)} />
        <Text $variant="xs" color="text.secondary">
          Use a custom Well Implementation instead
        </Text>
      </Flex>
      <Flex $fullWidth $direction="row" $justifyContent="space-between">
        <ButtonPrimary $variant="outlined" disabled>
          Back: Choose Aquifer
        </ButtonPrimary>
        <ButtonPrimary disabled>Next: Customize Well</ButtonPrimary>
      </Flex>
    </FormWrapper>
  );
};

const MayLink = ({ url, children }: { url?: string; children: React.ReactNode }) => {
  if (url) {
    return <LinkWrapper to={url}>{children}</LinkWrapper>;
  }
  return children;
};

const LinkWrapper = styled(Link).attrs({
  target: "_blank",
  rel: "noopener noreferrer",
  onclick: (e: React.MouseEvent) => e.stopPropagation()
})`
  text-decoration: none;
  outline: none;
`;

const FormWrapper = styled(Flex)`
  max-width: 710px;
  width: 100%;
`;

const IconImg = styled.img<{ $rounded?: boolean }>`
  max-height: 16px;
  max-width: 16px;
  border-radius: 50%;
  margin-bottom: ${theme.spacing(-0.25)};
`;

const toPlural = (word: string, count: number) => {
  const suffix = count === 1 ? "" : "s";
  return `${word}${suffix}`;
};
