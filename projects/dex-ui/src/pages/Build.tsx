import React from "react";
import { useNavigate } from "react-router-dom";
import { InfoActionRow } from "src/components/Common/InfoActionRow";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { Text } from "src/components/Typography";
import styled from "styled-components";

export const Build = () => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate("/well-creator");
  };

  return (
    <Page>
      <Title title="Build" />
      <Text variant="l" color="text.secondary">
        Basin has three unique components which can be composed together to create a custom liquidity pool, or Well.
      </Text>
      <InfoActionRow label="Use the Well Creator to deploy your own Wells." buttonLabel="Well Creator →" onClick={handleNavigate} />
      <div>
        <Text variant="h2">COMPONENT LIBRARY</Text>
        <Text variant="l" color="text.secondary">
          Use existing components which are already available for developers to extend, copy or compose together when building Wells. Select
          a component to view its implementation.
        </Text>
      </div>
    </Page>
  );
};
