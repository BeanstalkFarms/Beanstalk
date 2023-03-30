import { Well } from "@beanstalk/sdk/Wells";
import { useEffect, useState } from "react";
import useSdk from "src/utils/sdk/useSdk";
import { useQuery } from "@tanstack/react-query";

export const useWell = (address: string) => {
  const sdk = useSdk();

  const { data, isLoading, error } = useQuery(["wells", address], async () => {
    console.log("fetching well");
    return sdk.wells.getWell(address);
  });

  return { well: data, loading: isLoading, error };
};



