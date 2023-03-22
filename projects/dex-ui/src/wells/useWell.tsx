import { Well } from "@beanstalk/sdk/Wells";
import { useEffect, useState } from "react";
import useSdk from "src/utils/sdk/useSdk";

export const useWell = (address: string) => {
  const sdk = useSdk();
  const [well, setWell] = useState<Well>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let listen = true;
    const fetchData = async () => {
      setLoading(true);
      setError(undefined);
      const well = await sdk.wells.getWell(address);
      if (listen) setWell(well);
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
  }, [address]);

  return { well, loading, error };
};
