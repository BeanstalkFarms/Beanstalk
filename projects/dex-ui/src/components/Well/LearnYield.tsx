import React from "react";

import { ExpandBox } from "src/components/ExpandBox";
import { TextNudge } from "../Typography";
import { FC } from "src/types";
import { YieldSparkle } from "../Icons";

type Props = {};
export const LearnYield: FC<Props> = ({}) => {
  return (
    <ExpandBox width={408}>
      <ExpandBox.Header>
        <YieldSparkle />
        <TextNudge amount={1}>How can I earn yield?</TextNudge>
      </ExpandBox.Header>
      <ExpandBox.Body>Yield details here</ExpandBox.Body>
    </ExpandBox>
  );
};
