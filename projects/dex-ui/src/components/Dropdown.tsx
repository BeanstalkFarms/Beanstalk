import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import styled from "styled-components";
import { theme } from "src/utils/ui/theme";
import { Flex } from "./Layout";
import useElementDimensions from "src/utils/ui/useDimensions";

export type DropdownProps = {
  open: boolean;
  trigger: React.ReactNode;
  children: React.ReactNode;
  setOpen: (open: boolean) => void;
  offset?: number;
};

const Dropdown = ({ open, children, trigger, offset, setOpen }: DropdownProps) => {
  const [ref, dimensions] = useElementDimensions();

  return (
    <StyledRoot open={open} onOpenChange={setOpen}>
      <TriggerContainer ref={ref}>
        <DropdownMenu.Trigger
          asChild
          onMouseDown={(e: any) => e.preventDefault()}
          onClick={(e: any) => e.preventDefault()}
        >
          {trigger}
        </DropdownMenu.Trigger>
      </TriggerContainer>
      <DropdownMenu.Portal>
        <StyledContent
          $width={dimensions.width}
          sideOffset={offset}
          onFocus={(e: any) => e.preventDefault()}
        >
          <>{children}</>
        </StyledContent>
      </DropdownMenu.Portal>
    </StyledRoot>
  );
};

const TriggerContainer = styled(Flex)`
  position: relative;
`;

const StyledSingleSelect = styled(DropdownMenu.CheckboxItem)<{ selected: boolean }>`
  display: flex;
  box-sizing: border-box;
  width: 100%;
  outline: none;
  cursor: pointer;
  padding: ${theme.spacing(1, 2)};
  background: ${(p) => (p.selected ? theme.colors.primaryLight : "white")};

  :hover {
    background-color: ${theme.colors.primaryLight};
  }
`;

const StyledRoot = styled(DropdownMenu.Root)`
  position: "relative";
`;

const StyledContent = styled(DropdownMenu.Content)<{ $width: number }>`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-width: ${(p) => `${p.$width}px` || "100%"};
  width: ${(p) => `${p.$width}px` || "100%"};
  min-width: ${(p) => `${p.$width}px` || "100%"};
  background-color: white;
  border-radius: 0px;
  animation-duration: 400ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
`;

const Namespace = Object.assign(Dropdown, {
  SingleSelect: StyledSingleSelect
});

export { Namespace as Dropdown };
