import React, { useState } from "react";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { useWells } from "src/wells/useWells";
import { WellImplementationCard } from "../WellImplementationCard";
import { ToggleSwitch } from "src/components/ToggleSwitch";

export const ChooseWellImplementation = () => {
  const { data: wells } = useWells();
  const [isCustomWell, setIsCustomWell] = useState(false);

  return (
    <Flex $gap={2}>
      <Text $lineHeight="l">Which Well Implementation do you want to use?</Text>
      {(wells || []).map((well) => (
        <WellImplementationCard selected={false} well={well} key={`well-implementation-card-${well.address}`} />
      ))}
      <ToggleSwitch checked={isCustomWell} toggle={() => setIsCustomWell((prev) => !prev)} />
    </Flex>
  );
};
