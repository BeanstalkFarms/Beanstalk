import React from "react";
import { useNavigate } from "react-router-dom";
import { ButtonPrimary } from "src/components/Button";

import { Flex } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { Text } from "src/components/Typography";

import { theme } from "src/utils/ui/theme";
import styled from "styled-components";

import { ComponentLibraryTable } from "src/components/Create/ComponentLibraryTable";

export const Build = () => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate("/create");
  };

  return (
    <Page>
      <Flex $gap={0.5}>
        <Title title="Build" fontWeight={"600"} largeOnMobile />
        <Text $variant="l" $color="text.secondary">
          Basin has three unique components which can be composed together to create a custom
          liquidity pool, or Well.
        </Text>
      </Flex>
      <ActionBanner>
        <Text $variant="l" className="banner-text">
          Use the Well Deployer to deploy your own Wells.
        </Text>
        <NavigateButton onClick={handleNavigate}>Well Deployer →</NavigateButton>
      </ActionBanner>
      <Flex $gap={0.5} $mt={3}>
        <Text $variant="h3">COMPONENT LIBRARY</Text>
        <Text $variant="l" $color="text.secondary">
          Use existing components which are already available for developers to extend, copy or
          compose together when building Wells. Select a component to view its implementation.
        </Text>
      </Flex>
      <ComponentLibraryTable />
    </Page>
  );
};

const ActionBanner = styled(Flex).attrs({
  $py: 2,
  $px: 3,
  $justifyContent: "space-between",
  $alignItems: "center",
  $direction: "row",
  $gap: 2
})`
  background: ${theme.colors.white};
  border: 0.25px solid ${theme.colors.gray};

  @media (max-width: 500px) {
    flex-direction: column;
    gap: ${theme.spacing(2)};

    .banner-text {
      align-self: flex-start;
    }
  }
`;

const NavigateButton = styled(ButtonPrimary)`
  white-space: nowrap;

  /* ${theme.media.query.sm.only} { */
  @media (max-width: 500px) {
    align-self: flex-end;
    width: 100%;
  }
`;
