import { Well } from "@beanstalk/sdk/Wells";
import { useEffect, useState } from "react";
import { WELL_ADDRESSES } from "src/constants/addresses";
import useSdk from "src/utils/sdk/useSdk";
import { useQuery } from "@tanstack/react-query";

export const useWells = () => {
  const sdk = useSdk();

  const { data, isLoading, error } = useQuery(["wells"], () => {
    return Promise.all(
      WELL_ADDRESSES.map((address) => {
        return sdk.wells.getWell(address, {
          name: true
        });
      })
    );
  });

  return { wells: data, loading: isLoading, error };
};
