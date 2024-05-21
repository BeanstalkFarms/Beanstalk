import React from "react";
import { useNavigate } from "react-router-dom";
import { ButtonPrimary } from "src/components/Button";

import { Flex } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { Text } from "src/components/Typography";

import { theme } from "src/utils/ui/theme";
import styled from "styled-components";

export const Build = () => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate("/well-creator");
  };

  return (
    <Page>
      <Flex $gap={0.5}>
        <Title title="Build" fontWeight={"600"} largeOnMobile />
        <Text $variant="l" color="text.secondary">
          Basin has three unique components which can be composed together to create a custom liquidity pool, or Well.
        </Text>
      </Flex>
      <ActionBanner>
        <Text $variant="l">Use the Well Creator to deploy your own Wells.</Text>
        <ButtonPrimary onClick={handleNavigate}>Well Creator →</ButtonPrimary>
      </ActionBanner>
      <Flex $gap={0.5} $mt={3}>
        <Text $variant="h2">COMPONENT LIBRARY</Text>
        <Text $variant="l" $color="text.secondary">
          Use existing components which are already available for developers to extend, copy or compose together when building Wells. Select
          a component to view its implementation.
        </Text>
      </Flex>
    </Page>
  );
};

const ActionBanner = styled(Flex).attrs({
  $py: 3,
  $px: 2,
  $justifyContent: "space-between",
  $alignItems: "center",
  $direction: "row"
})`
  background: ${theme.colors.white};
  border: 0.25px solid ${theme.colors.gray};
`;
