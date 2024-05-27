import React from "react";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import styled from "styled-components";
import { ComponentInputWithCustom } from "../ComponentInputWithCustom";

const additionalOptions = [
  {
    value: "none",
    label: "None",
    subLabel: "No Oracle"
  }
];

export const PumpSelectFormSection = () => {
  return (
    <SectionWrapper $direction="row" $justifyContent="space-between" $fullWidth>
      <Flex $gap={2} className="description" $justifyContent="flex-start">
        <Text $variant="h3">Pumps</Text>
        <Text $variant="xs">Choose Pump(s) to set up a price feed from your Well.</Text>
      </Flex>
      <Flex className="form-section" $gap={2} $fullWidth>
        <ComponentInputWithCustom
          componentType="pumps"
          path="pump"
          toggleMessage="Use a custom Pump"
          emptyValue=""
          additional={additionalOptions}
        />
      </Flex>
    </SectionWrapper>
  );
};

const SectionWrapper = styled(Flex)`
  .description {
    max-width: 180px;
  }

  .form-section {
    max-width: 713px;
    width: 100%;
  }
`;
