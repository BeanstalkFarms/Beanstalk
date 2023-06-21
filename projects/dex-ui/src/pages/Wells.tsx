import { Well } from "@beanstalk/sdk/Wells";
import React, { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { Row, TBody, THead, Table, Td, Th } from "src/components/Table";
import { TokenLogo } from "src/components/TokenLogo";
import { useWells } from "src/wells/useWells";
import styled from "styled-components";

export const Wells = () => {

  return (
    <Page>
      <Title title="Liquidity" />

      Coming soon...
    </Page>
  );
};
