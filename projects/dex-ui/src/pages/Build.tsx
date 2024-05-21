import React from "react";
import { useNavigate } from "react-router-dom";

import { InfoActionRow } from "src/components/Common/InfoActionRow";
import { StyledDiv, Flex } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { Text } from "src/components/Typography";
import { theme } from "src/utils/ui/theme";
import { css } from "styled-components";

export const Build = () => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate("/well-creator");
  };

  return (
    <Page>
      <Flex gap={0.5}>
        <Title title="Build" fontWeight={"600"} largeOnMobile />
        <Text variant="l" color="text.secondary">
          Basin has three unique components which can be composed together to create a custom liquidity pool, or Well.
        </Text>
      </Flex>
      <StyledDiv css={styles.infoActionRowWrapper}>
        <InfoActionRow label="Use the Well Creator to deploy your own Wells." buttonLabel="Well Creator →" onClick={handleNavigate} />
      </StyledDiv>
      <Flex gap={0.5}>
        <Text variant="h2">COMPONENT LIBRARY</Text>
        <Text
          variant="l"
          color="text.secondary"
          css={css`
            margin-top: ${theme.spacing(0.5)};
          `}
        >
          Use existing components which are already available for developers to extend, copy or compose together when building Wells. Select
          a component to view its implementation.
        </Text>
      </Flex>
    </Page>
  );
};

const styles = {
  infoActionRowWrapper: css`
    margin-bottom: ${theme.spacing(3)};
  `
};
