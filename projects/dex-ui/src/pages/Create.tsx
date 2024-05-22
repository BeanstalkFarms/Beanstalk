import React from "react";
import { Flex } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Text } from "src/components/Typography";

import styled from "styled-components";

export const Create = () => {
  return (
    <Page>
      <Flex $gap={3} $fullWidth>
        <Text $variant="h2">Create a Well - Choose a Well Implementation</Text>
        <Flex $direction="row" $alignItems="flex-start" $gap={8}>
          <InstructionContainer>
            <Text $color="text.secondary" $lineHeight="l">
              Deploy a Well using Aquifer, a Well factory contract.
            </Text>
            <Text $color="text.secondary" $lineHeight="l">
              It is recommended to use the Well.sol Well Implementation, but you&apos;re welcome to use a custom contract.
            </Text>
            <Text $color="text.secondary" $lineHeight="l">
              Visit the documentation to learn more about Aquifers and Well Implementations.
            </Text>
          </InstructionContainer>
          <Flex $gap={2}>
            <Text $lineHeight="l">Which Well Implementation do you want to use?</Text>
          </Flex>
        </Flex>
      </Flex>
    </Page>
  );
};

const InstructionContainer = styled(Flex).attrs({
  $gap: 2
})`
  max-width: 274px;
`;
