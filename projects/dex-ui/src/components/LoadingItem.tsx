import React, { FC } from "react";
import { Skeleton, SkeletonProps } from "./Skeleton";

type BaseProps = {
  loading?: boolean;
  children: React.ReactNode | React.ReactNode[];
};

type WithOnLoadingProps = BaseProps & {
  onLoading: JSX.Element | null;
  loadProps?: never; // Indicate that skeletonProps should not be provided
};

type WithoutOnLoadingProps = BaseProps & {
  onLoading?: never;
  loadProps: SkeletonProps; // Ensure SkeletonProps are provided
};

type Props = WithOnLoadingProps | WithoutOnLoadingProps;

export const LoadingItem: FC<Props> = ({ loading, onLoading, children, loadProps }) => {
  if (!loading) {
    return <>{children}</>;
  }

  if (onLoading !== undefined) {
    return <>{onLoading}</>;
  }

  return <Skeleton {...loadProps} />;
};
