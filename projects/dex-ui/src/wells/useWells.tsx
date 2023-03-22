import { Well } from "@beanstalk/sdk/Wells";
import { useEffect, useState } from "react";
import { WELL_ADDRESSES } from "src/constants/addresses";
import useSdk from "src/utils/sdk/useSdk";

export const useWells = () => {
  const sdk = useSdk();
  const [wells, setWells] = useState<Well[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let listen = true;
    const fetchData = async () => {
      setLoading(true);
      setError(undefined);
      const wells = await Promise.all(
        WELL_ADDRESSES.map((address) => {
          console.log(address);
          return sdk.wells.getWell(address, {
            name: true
          });
        })
      );
      if (listen) setWells(wells);
    };

    fetchData()
      .catch((err) => {
        console.log(err);
        setError(err);
      })
      .finally(() => setLoading(false));

    return () => {
      listen = false;
    };
  }, []);

  return { wells, loading, error };
};
