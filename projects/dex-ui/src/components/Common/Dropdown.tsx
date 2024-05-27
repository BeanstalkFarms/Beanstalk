// import React, { useState, createContext, useCallback, Children, useMemo } from "react";
// import {
//   useFloating,
//   useClick,
//   useDismiss,
//   useRole,
//   useListNavigation,
//   useInteractions,
//   FloatingFocusManager,
//   useTypeahead,
//   offset,
//   flip,
//   size,
//   autoUpdate,
//   FloatingPortal,
//   UseInteractionsReturn
// } from "@floating-ui/react";
// import styled, { FlattenSimpleInterpolation } from "styled-components";
// import { CssProps, FontVariant, theme } from "src/utils/ui/theme";
// import { Control, FieldValues, Path, PathValue, useFormContext, useWatch } from "react-hook-form";
// import { Text } from "src/components/Typography";

// type DropdownLookupValue = {
//   value: string;
//   index: number;
//   disabled?: boolean;
// };

// type DropdownFieldContextType = {
//   activeIndex: number | null;
//   selectedIndex: number | null;
//   listItemsRef: React.MutableRefObject<(HTMLElement | null)[]>;
//   getItemProps: UseInteractionsReturn["getItemProps"];
//   handleSelect: (index: number) => void;
//   lookupMapByValue: Record<string, DropdownLookupValue>;
// };

// const DropdownFieldContext = createContext({} as DropdownFieldContextType);

// type DropdownFieldOptionProps = {
//   value: string;
//   children: React.ReactNode;
//   disabled?: boolean;
// };

// const DropdownFieldOption = ({ value }: DropdownFieldOptionProps) => {
//   const { activeIndex, selectedIndex, listItemsRef, lookupMapByValue, getItemProps, handleSelect } =
//     React.useContext(DropdownFieldContext);

//   const i = lookupMapByValue[value].index;

//   return (
//     <StyledDropdownFieldOption
//       $active={i === activeIndex}
//       key={value}
//       ref={(node) => {
//         listItemsRef.current[i] = node;
//       }}
//       role="option"
//       tabIndex={i === activeIndex ? 0 : -1}
//       aria-selected={i === selectedIndex && i === activeIndex}
//       {...getItemProps({
//         // Handle pointer select.
//         onClick() {
//           handleSelect(i);
//         }
//       })}
//     >
//       {value}
//       <span
//         aria-hidden
//         style={{
//           position: "absolute",
//           right: 10
//         }}
//       >
//         {i === selectedIndex ? " ✓" : ""}
//       </span>
//     </StyledDropdownFieldOption>
//   );
// };

// const StyledDropdownFieldOption = styled.div<{ $active?: boolean }>`
//   display: flex;
//   flex-direction: row;
//   align-items: center;
//   cursor: default;
//   border: none;
//   outline: none;
//   padding: ${theme.spacing(1, 2)};
//   background: ${(props) => (props.$active ? theme.colors.primaryLight : theme.colors.white)};
// `;

// export type DropdownFieldProps<T extends FieldValues> = {
//   children: React.ReactNode;
//   control: Control<T>;
//   name: Path<T>;
//   onChange?: (str: any) => void;
//   placeholder?: string;
//   align?: "left" | "center" | "right";
//   variant?: FontVariant;
//   css?: FlattenSimpleInterpolation;
// };

// const DropdownField = <T extends FieldValues>({
//   children,
//   control,
//   name,
//   onChange,
//   placeholder,
//   align,
//   variant,
//   css: dropdownCss
// }: DropdownFieldProps<T>) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [activeIndex, setActiveIndex] = useState<number | null>(null);
//   const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

//   const value = useWatch<T>({ control: control, name });
//   const { setValue } = useFormContext<T>();

//   const lookupMap = useMemo(() => {
//     const byValue = {} as Record<string, DropdownLookupValue>;
//     const byIndex = {} as Record<number, DropdownLookupValue>;

//     Children.toArray(children).flatMap((child, i) => {
//       const childProps = (child as React.ReactElement<DropdownFieldOptionProps>).props;
//       const lookup = {
//         value: childProps.value,
//         index: i,
//         disabled: childProps.disabled
//       };

//       byValue[childProps.value] = { ...lookup };
//       byIndex[i] = { ...lookup };
//     });

//     return { byValue, byIndex };
//   }, [children]);

//   const childValues = useMemo(() => {
//     return Object.values(lookupMap.byValue).map((entry) => entry.value);
//   }, [lookupMap.byValue]);

//   const { refs, floatingStyles, context } = useFloating<HTMLElement>({
//     placement: "bottom",
//     open: isOpen,
//     onOpenChange: setIsOpen,
//     whileElementsMounted: autoUpdate,
//     middleware: [
//       offset(0),
//       flip({ padding: 10 }),
//       size({
//         apply({ rects, elements, availableHeight }) {
//           Object.assign(elements.floating.style, {
//             maxHeight: `${availableHeight}px`,
//             minWidth: `${rects.reference.width}px`
//           });
//         },
//         padding: 16
//       })
//     ]
//   });

//   const listRef = React.useRef<Array<HTMLElement | null>>([]);

//   const click = useClick(context, { event: "mousedown" });
//   const dismiss = useDismiss(context);
//   const role = useRole(context, { role: "listbox" });
//   const listNav = useListNavigation(context, {
//     listRef,
//     activeIndex,
//     selectedIndex,
//     onNavigate: setActiveIndex,
//     loop: true
//   });
//   const typeahead = useTypeahead(context, {
//     listRef: { current: childValues },
//     activeIndex,
//     selectedIndex,
//     onMatch: (matchedIndex) => {
//       if (lookupMap.byIndex[matchedIndex]?.disabled) return;
//       if (isOpen) setActiveIndex(matchedIndex);
//       if (!isOpen) setSelectedIndex(matchedIndex);
//     }
//   });

//   const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
//     dismiss,
//     role,
//     listNav,
//     typeahead,
//     click
//   ]);

//   const handleSelect = useCallback(
//     (index: number) => {
//       const val = childValues[index] as PathValue<T, Path<T>>;
//       setSelectedIndex(index);
//       onChange ? onChange(val) : setValue(name, val);
//       setIsOpen(false);
//     },
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     [lookupMap.byIndex, name]
//   );

//   return (
//     <DropdownDiv $align={align}>
//       <StyledDropdownField
//         // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
//         tabIndex={0}
//         ref={refs.setReference}
//         aria-labelledby="select-label"
//         aria-autocomplete="none"
//         {...getReferenceProps()}
//         $css={dropdownCss}
//       >
//         <Text $variant={variant}>{value || placeholder || "Select..."}</Text>
//       </StyledDropdownField>
//       <DropdownFieldContext.Provider
//         value={{
//           lookupMapByValue: lookupMap.byValue,
//           activeIndex,
//           selectedIndex,
//           listItemsRef: listRef,
//           handleSelect,
//           getItemProps
//         }}
//       >
//         {isOpen && (
//           <FloatingPortal>
//             <FloatingFocusManager context={context} modal={false}>
//               <FloatingInner
//                 ref={refs.setFloating}
//                 style={{ ...floatingStyles }}
//                 {...getFloatingProps()}
//               >
//                 {children}
//               </FloatingInner>
//             </FloatingFocusManager>
//           </FloatingPortal>
//         )}
//       </DropdownFieldContext.Provider>
//     </DropdownDiv>
//   );
// };

// const FloatingInner = styled.div`
//   overflow-y: auto;
//   background: ${theme.colors.white};
//   min-width: 100px;
//   outline: 0;
// `;

// const StyledDropdownField = styled.div<CssProps>`
//   display: flex;
//   ${(props) => props.$css ?? ""}
// `;

// const DropdownDiv = styled.div<CssProps & { $align?: "left" | "center" | "right" }>`
//   //   display: flex;
//   //   width: 100%;
//   //   align-items: center;

//   [role="option"]:focus {
//     outline: 0;
//   }

//   [role="combobox"] {
//     display: flex;
//     align-items: center;
//     justify-content: ${(props) =>
//       props.$align === "right" ? "flex-end" : props.$align === "center" ? "center" : "flex-start"};
//     background: ${theme.colors.white};
//     border: 1px solid ${theme.colors.black};
//     user-select: none;
//     padding: ${theme.spacing(1, 2)};
//   }
// `;

// const Namespace = Object.assign(DropdownField, {
//   Option: DropdownFieldOption
// });

// export { Namespace as DropdownField };
