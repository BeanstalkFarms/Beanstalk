import React from "react";
import { Flex } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Text } from "src/components/Typography";
import { theme } from "src/utils/ui/theme";

import styled from "styled-components";

export const Create = () => {
  return (
    <Page>
      <Flex $gap={3} $fullWidth>
        <Text $variant="h2">Create a Well - Choose a Well Implementation</Text>
        <Flex $direction="row" $alignItems="flex-start">
          <InstructionContainer>
            <InstructionText>Deploy a Well using Aquifer, a Well factory contract.</InstructionText>
            <InstructionText>
              It is recommended to use the Well.sol Well Implementation, but you&apos;re welcome to use a custom contract.
            </InstructionText>
            <InstructionText>Visit the documentation to learn more about Aquifers and Well Implementations.</InstructionText>
          </InstructionContainer>
        </Flex>
      </Flex>
    </Page>
  );
};

const InstructionContainer = styled(Flex).attrs({
  $gap: 2
})`
  max-width: 274px;
  line-height: ${theme.font.size("l")};
`;

const InstructionText = styled(Text).attrs({
  $color: "text.secondary"
})`
  line-height: inherit;
`;
