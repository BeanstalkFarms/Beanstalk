import React from "react";
import { ExpandBox } from "src/components/ExpandBox";
import { TextNudge } from "../Typography";

import { FC } from "src/types";
import { WellFunction } from "../Icons";

export const LearnWellFunction: FC<{ name: string }> = ({ name }) => {
  return (
    <ExpandBox width={408}>
      <ExpandBox.Header>
        <WellFunction />
        <TextNudge amount={1}>What is {name}?</TextNudge>
      </ExpandBox.Header>
      <ExpandBox.Body>Well function details here</ExpandBox.Body>
    </ExpandBox>
  );
};
