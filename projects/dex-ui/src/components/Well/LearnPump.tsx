import React from "react";
import { ExpandBox } from "src/components/ExpandBox";
import styled from "styled-components";
import { FC } from "src/types";
import { Well } from "@beanstalk/sdk-wells";
import { getIsMultiPumpWell } from "src/wells/useBeanstalkSiloWhitelist";
import { formatWellTokenSymbols } from "src/wells/utils";

type Props = {
  well: Well | undefined;
};

function PumpDetails({ well }: Props) {
  const isMultiPumpWell = getIsMultiPumpWell(well);

  return (
    <TextContainer>
      <div>
        Pumps are the oracle framework of Basin. Well deployers can define the conditions under
        which the Well should write new reserve data to the Pump, which can be used as a data feed.
      </div>
      {isMultiPumpWell && (
        <div>
          The{" "}
          <StyledLink
            href="https://basin.exchange/multi-flow-pump.pdf"
            target="_blank"
            rel="noopener"
          >
            Multi Flow Pump
          </StyledLink>{" "}
          is attached to {well?.tokens ? `the ${formatWellTokenSymbols(well)} Well` : "this well"}.
        </div>
      )}
    </TextContainer>
  );
}

export const LearnPump: FC<Props> = ({ well }) => {
  return (
    <ExpandBox drawerHeaderText="🔮 What’s a pump?">
      <ExpandBox.Header>
        <span role="img" aria-label="glass globe emoji">
          🔮
        </span>{" "}
        What is a Pump?
      </ExpandBox.Header>
      <ExpandBox.Body>
        <PumpDetails well={well} />
      </ExpandBox.Body>
    </ExpandBox>
  );
};

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: #4b5563;
`;

const StyledLink = styled.a`
  font-weight: 600;
  color: #4b5563;
  text-decoration-thickness: 1px;
`;
