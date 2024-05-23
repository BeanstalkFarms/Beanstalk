import React, { useState } from "react";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { useWells } from "src/wells/useWells";
import { ToggleSwitch } from "src/components/ToggleSwitch";
import { ButtonPrimary } from "src/components/Button";
import { BEANETH_ADDRESS } from "src/utils/addresses";
import BeanstalkFarmsLogo from "src/assets/images/beanstalk-farms.png";
import HalbornLogo from "src/assets/images/halborn-logo.png";
import { AccordionSelectCard } from "src/components/Common/ExpandableCard";
import styled from "styled-components";
import { theme } from "src/utils/ui/theme";

// Can we make this dynamic??
export const entries = {
  [BEANETH_ADDRESS.toLowerCase()]: {
    name: "Well.sol",
    description: [
      "A standard Well implementation that prioritizes flexibility and composability.",
      "Fits many use cases for a Liquidity Well."
    ],
    deployer: {
      name: "Beanstalk Farms",
      imgSrc: BeanstalkFarmsLogo
    },
    blockDeployed: 12345678, // FIX ME
    auditor: {
      name: "Halborn",
      imgSrc: HalbornLogo
    }
  }
};

export const ChooseWellImplementation = () => {
  const [selected, setSelected] = useState<string>("");
  const { data: wells } = useWells();
  const [isCustomWell, setIsCustomWell] = useState(false);

  const handleSetSelected = (addr: string) => {
    console.log("addr: ", addr);
    console.log("curr: ", selected);
    const isSelected = selected === addr;
    setSelected(isSelected ? "" : addr);
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
              <div>
                <InlineText $weight="semi-bold" $variant="xs">
                  {data.name}{" "}
                  <Text as="span" $color="text.secondary" $weight="normal" $variant="xs">
                    {"(Recommended)"}
                  </Text>
                </InlineText>
                {data.description.map((text, j) => (
                  <Text $color="text.secondary" $variant="xs" key={`description-${i}-${j}`}>
                    {text}
                  </Text>
                ))}
              </div>
            </Flex>
          }
          below={
            <Flex $gap={0.5}>
              <Flex $direction="row" $justifyContent="space-between">
                <Text $color="text.secondary">Deployed By: </Text>
              </Flex>
            </Flex>
          }
          defaultExpanded
          onClick={() => handleSetSelected(address)}
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

const Inline = styled.div`
  display: inline;
  // gap: ${theme.spacing(0.5)};
`;

const FormWrapper = styled(Flex)`
  max-width: 710px;
  width: 100%;
`;

const InlineText = styled(Text)`
  display: inline;
`;
