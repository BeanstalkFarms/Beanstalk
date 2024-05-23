import React from "react";
import { Flex } from "src/components/Layout";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { Text } from "src/components/Typography";
import { Well } from "@beanstalk/sdk/Wells";
import { BEANETH_ADDRESS } from "src/utils/addresses";

export const WellAddressToImplementationMap = {
  [BEANETH_ADDRESS.toLowerCase()]: {
    name: "Well.sol",
    description: "A standard Well implementation that prioritizes flexibility and composability."
  }
};

type Props = {
  well: Well;
  selected: boolean;
};

export const WellImplementationCard = ({ well, selected }: Props) => {
  const address = well.address.toLowerCase() || "";
  const entry = WellAddressToImplementationMap[address];

  if (!entry) return null;

  return (
    <Card $active={selected}>
      <Flex $gap={2}>
        <Flex $direction="row" $gap={2}>
          <div>
            <InlineText $weight="semi-bold" $variant="xs">
              {entry.name}{" "}
              <Text as="span" $color="text.secondary" $weight="normal" $variant="xs">
                {"(Recommended)"}
              </Text>
            </InlineText>
            <Text $color="text.secondary" $variant="xs">
              {entry.description}
            </Text>
          </div>
        </Flex>
        <Divider />
        <Flex $gap={2}></Flex>
      </Flex>
    </Card>
  );
};

const Divider = styled.div`
  width: 100%;
  border-bottom: 1px solid ${theme.colors.lightGray};
`;

const Card = styled.div<{ $active: boolean }>`
  border: 1px solid ${theme.colors.black};
  background: ${(props) => (props.$active ? theme.colors.primaryLight : theme.colors.white)};
  padding: ${theme.spacing(2, 3)};
  cursor: pointer;
`;

const InlineText = styled(Text)`
  display: inline;
`;
