import { useQuery } from "@tanstack/react-query";
import { BasinAPIResponse } from "src/types";
import { Log } from "src/utils/logger";

const useBasinStats = () => {

  return useQuery({
    queryKey: ["wells", "basinStats"],

    queryFn: async () => {
        let output: BasinAPIResponse[] = [];
        try {
            const apiQuery = await fetch('https://api.bean.money/basin/tickers', {
                    headers: {
                    'accept': 'application/json'
                    }
                })
            
            output = await apiQuery.json() as BasinAPIResponse[];
        } catch (e) {
            Log.module("useBasinStats").error("Failed to fetch data from Basin API :",  e)
        };
        return output;
    },
    staleTime: 1000 * 120
  });
};

export default useBasinStats;