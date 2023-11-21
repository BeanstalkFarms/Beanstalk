import React from "react";
import styled from "styled-components";
import { Skeleton } from "./Skeleton";
import { ArrowButton } from "./Swap/ArrowButton";

type MarginProps = {
  left?: number;
  right?: number;
  bottom?: number;
  top?: number;
};

type DimensionProps = {
  height?: number;
  width?: number;
};

const getMarginStyles = (props: { margin?: MarginProps }) => `
  margin-bottom: ${props.margin?.bottom ? props.margin.bottom : 0}px;
  margin-top: ${props.margin?.top ? props.margin.top : 0}px;
  margin-right: ${props.margin?.right ? props.margin.right : 0}px;
  margin-left: ${props.margin?.left ? props.margin.left : 0}px;
`;

export function LoadingTemplate(props: FlexProps & { children: React.ReactNode }) {
  return <FlexBox {...props} />;
}

LoadingTemplate.Input = () => (
  <LoadingInputItem>
    {"-"}
    <SkeletonRow>
      <Skeleton width={16} height={16} circle />
      <Skeleton width={48} height={24} />
    </SkeletonRow>
  </LoadingInputItem>
);

LoadingTemplate.Arrow = () => (
  <ArrowContainer>
    <ArrowButton onClick={() => {}} />
  </ArrowContainer>
);

LoadingTemplate.OutputDouble = ({ size, height }: { size?: number; height?: number }) => (
  <OutputRow>
    <Background width={90} height={height}>
      <Skeleton width={90} height={size ? size : 24} />
    </Background>
    <Background width={70} height={height}>
      <Skeleton width={70} height={size ? size : 24} />
    </Background>
  </OutputRow>
);

LoadingTemplate.LabelValue = ({ height, labelWidth, valueWidth }: { height?: number; labelWidth?: number; valueWidth?: number }) => (
  <OutputRow>
    <Background width={labelWidth}>
      <Skeleton width={labelWidth} height={height || 24} />
    </Background>
    <Background width={valueWidth}>
      <Skeleton width={valueWidth} height={height || 24} />
    </Background>
  </OutputRow>
);

LoadingTemplate.Button = () => (
  <Background>
    <Skeleton height={48} />
  </Background>
);

LoadingTemplate.Item = ({ height, width, margin }: DimensionProps & { margin?: MarginProps }) => (
  <Background width={width || 90} margin={margin} height={height}>
    <Skeleton width={width || 90} height={height || 24} />
  </Background>
);

LoadingTemplate.OutputSingle = ({ size, width, mb }: { size?: number; width?: number; mb?: number }) => (
  <Background width={width || 90} margin={{ bottom: mb }}>
    <Skeleton width={width || 90} height={size || 24} />
  </Background>
);

LoadingTemplate.Flex = (props: FlexProps & { children: React.ReactNode }) => <FlexBox {...props} />;

LoadingTemplate.TokenLogo = ({ count = 1, size, mobileSize }: { count?: number; size: number; mobileSize?: number }) => {
  if (count === 0) return null;

  if (count === 1) {
    return (
      <Background height={size} width={size} circle>
        <Skeleton height={size} width={size} circle />
      </Background>
    );
  }

  return (
    <FlexBox row>
      {Array(count)
        .fill(null)
        .map((_, i) => (
          <Background height={size} width={size} circle key={`Token-Logo-skeleton-${i}`} margin={{ left: i === 0 ? 0 : -8 }}>
            <Skeleton height={size} width={size} circle />
          </Background>
        ))}
    </FlexBox>
  );
};

type FlexProps = {
  row?: boolean;
  gap?: number;
  alignItems?: string;
  justifyContent?: string;
  width?: string | number;
};

const FlexBox = styled.div<FlexProps>`
  display: flex;
  ${(props) => `
      flex-direction: ${props.row ? "row" : "column"};
      gap: ${props.gap || 0}px;
      ${props.alignItems && `align-items: ${props.alignItems};`}
      ${props.justifyContent && `justify-content: ${props.justifyContent};`}
      ${props.width && `width: ${typeof props.width === "string" ? props.width : `${props.width}px`}`}
  `}
`;

const Background = styled.div<{ width?: number; height?: number; margin?: MarginProps; circle?: boolean; rounded?: boolean }>`
  display: flex;
  background: white;
  ${(props) => `
    height: ${props.height ? `${props.height}px` : "100%"};
    width: ${props.width ? `${props.width}px` : "100%"};
    border-radius: ${props.circle ? "50%" : props.rounded === true ? "4px" : "0px"};
    ${getMarginStyles(props)}
  `}
`;

const OutputRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const LoadingInputItem = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  box-sizing: border-box;
  background: #fff;
  border: 0.5px solid #d1d5db;
  padding: 23.5px 8px;
  outline: 0.5px solid black;
`;

const SkeletonRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const ArrowContainer = styled.div`
  // border: 1px dashed orange;
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

type Responsive<T> =
  | {
      sm?: T;
      md?: T;
      lg?: T;
    }
  | T;

type FlexingProps = {
  height: number;
  width: number;
  alignItems?: string;
  justifyContent?: string;
};
