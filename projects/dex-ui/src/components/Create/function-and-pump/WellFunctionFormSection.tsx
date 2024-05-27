import React from "react";
import styled from "styled-components";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { ComponentInputWithCustom } from "../ComponentInputWithCustom";

export const WellFunctionFormSection = () => {
  return (
    <WellFunctionFormWrapper $direction="row" $fullWidth $justifyContent="space-between">
      <Flex $gap={2} className="description">
        <Text $variant="h3">Well Functions</Text>
        <Text $variant="xs" $color="text.secondary">
          Choose a Well Function to determine how the tokens in the Well get priced.
        </Text>
      </Flex>
      <Flex className="well-functions" $gap={2} $fullWidth>
        <ComponentInputWithCustom
          toggleMessage="Use a custom Well Implementation instead"
          path="wellFunction"
          componentType="wellFunctions"
        />
      </Flex>
    </WellFunctionFormWrapper>
  );
};

const WellFunctionFormWrapper = styled(Flex)`
  .description {
    max-width: 180px;
  }

  .well-functions {
    max-width: 713px;
    width: 100$;
  }
`;
