import React from "react";
import { ExpandBox } from "src/components/ExpandBox";

import { FC } from "src/types";

export const LearnPump: FC<{}> = ({}) => {
  return (
    <ExpandBox width={408}>
      <ExpandBox.Header>
        <span role="img" aria-label="glass globe emoji">
          🔮
        </span>{" "}
        What’s a pump?
      </ExpandBox.Header>
      <ExpandBox.Body>Well function details here</ExpandBox.Body>
    </ExpandBox>
  );
};
