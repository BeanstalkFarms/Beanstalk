import { useQuery } from "@tanstack/react-query";

type EtherscanEthPriceResponse = {
  ethbtc: string;
  ethbtc_timestamp: string;
  ethusd: string;
  ethusd_timestamp: string;
};

export type EthPriceResponse = {
  ethusd: string;
  ethusdTimestamp: string;
  lastRefreshed: string;
};

// TODO: Things like caching, etc.
const useEthPrice = () => {
  const getEthPrice = async () => {
    const response = await fetch(
      `https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${import.meta.env.VITE_ETHERSCAN_API_KEY}`
    );
    const data = await response.json().then((data) => data.result as EtherscanEthPriceResponse);
    return data.ethusd;
  };

  return useQuery(["ethprice"], getEthPrice);
};

export default useEthPrice;
