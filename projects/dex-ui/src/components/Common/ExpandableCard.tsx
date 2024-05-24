import React from "react";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { Flex } from "src/components/Layout";
import { ChevronDown, CircleEmptyIcon, CircleFilledCheckIcon } from "../Icons";
import { ImageButton } from "../ImageButton";
import { useBoolean } from "src/utils/ui/useBoolean";

export type AccordionSelectCardProps = {
  upper: React.ReactNode;
  selected: boolean;
  below: JSX.Element;
  defaultExpanded?: boolean;
  onClick: () => void;
};

export const AccordionSelectCard = ({ selected, below, upper, defaultExpanded = false, onClick }: AccordionSelectCardProps) => {
  const [expanded, { toggle }] = useBoolean(defaultExpanded);

  // console.log("redrender...");
  return (
    <ComponentWrapper $active={selected} onClick={onClick}>
      <Flex $direction="row" $alignItems="center" $fullWidth $justifyContent="space-between">
        <Flex $direction="row" $alignItems="center" $fullWidth $gap={2}>
          {selected ? <CircleFilledCheckIcon /> : <CircleEmptyIcon />}
          {upper}
        </Flex>
        <ImageButton
          component={ChevronDown}
          size={12}
          rotate={expanded ? "180" : "0"}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          padding={theme.spacing(1)}
          alt=""
        />
      </Flex>
      {expanded && (
        <>
          <Divider />
          {below}
        </>
      )}
    </ComponentWrapper>
  );
};

const ComponentWrapper = styled(Flex).attrs({ $gap: 2 })<{ $active: boolean }>`
  border: 1px solid ${theme.colors.black};
  background: ${(props) => (props.$active ? theme.colors.primaryLight : theme.colors.white)};
  padding: ${theme.spacing(2, 3)};
  cursor: pointer;
`;

const Divider = styled.div`
  width: 100%;
  border-bottom: 1px solid ${theme.colors.lightGray};
`;
