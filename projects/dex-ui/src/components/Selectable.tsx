import React from "react";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { Flex } from "src/components/Layout";
import { ChevronDown, CircleEmptyIcon, CircleFilledCheckIcon } from "./Icons";
import { ImageButton } from "./ImageButton";
import { useBoolean } from "src/utils/ui/useBoolean";


type SelectnIndicatorIconProps = {
  selected: boolean;
  size?: number;
};
export const SelectIndicatorIcon = ({ selected, size = 16 }: SelectnIndicatorIconProps) => {
  return (
    <ExactSize size={size}>
      {selected ? (
        <CircleFilledCheckIcon width={size} height={size} />
      ) : (
        <CircleEmptyIcon color={theme.colors.lightGray} width={size} height={size} />
      )}
    </ExactSize>
  );
};

const ExactSize = styled.div<{ size: number }>`
  min-width: ${(props) => props.size}px;
  min-height: ${(props) => props.size}px;
  max-height: ${(props) => props.size}px;
  max-width: ${(props) => props.size}px;
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;
`;

type AccordionSelectCardProps = {
  upper: React.ReactNode;
  selected: boolean;
  below: JSX.Element;
  defaultExpanded?: boolean;
  onClick: React.MouseEventHandler<HTMLDivElement> | undefined;
};
export const AccordionSelectCard = ({
  selected,
  below,
  upper,
  defaultExpanded = false,
  onClick
}: AccordionSelectCardProps) => {
  const [expanded, { toggle }] = useBoolean(defaultExpanded);

  return (
    <SelectWrapper $active={selected} onClick={onClick}>
      <Flex $direction="row" $alignItems="center" $fullWidth $justifyContent="space-between">
        <Flex $direction="row" $alignItems="center" $fullWidth $gap={2}>
          <SelectIndicatorIcon selected={selected} />
          {upper}
        </Flex>
        <ImageButton
          component={ChevronDown}
          size={12}
          rotate={expanded ? "180" : "0"}
          onClick={(e) => {
            // prevent the card from being clicked
            e.preventDefault();
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
    </SelectWrapper>
  );
};

type SelectCardProps = {
  selected: boolean;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement> | undefined;
};
export const SelectCard = ({ selected, children, onClick }: SelectCardProps) => {
  return (
    <SelectWrapper $active={selected} onClick={onClick}>
      <Flex $direction="row" $alignItems="center" $fullWidth $gap={2}>
        <SelectIndicatorIcon selected={selected} />
        {children}
      </Flex>
    </SelectWrapper>
  );
};

const SelectWrapper = styled(Flex).attrs({ $gap: 2 })<{ $active: boolean }>`
  // width: 100%;
  border: 1px solid ${(props) => (props.$active ? theme.colors.black : theme.colors.lightGray)};
  background: ${(props) => (props.$active ? theme.colors.primaryLight : theme.colors.white)};
  padding: ${theme.spacing(2, 3)};
  cursor: pointer;
`;

const Divider = styled.div`
  width: 100%;
  border-bottom: 1px solid ${theme.colors.lightGray};
`;
