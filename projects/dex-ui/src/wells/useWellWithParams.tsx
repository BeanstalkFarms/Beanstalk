import { useParams } from "react-router-dom";
import { useWell } from "./useWell";

export const useWellWithParams = () => {
  const { address: wellAddress } = useParams<"address">();
  return useWell(wellAddress || "");
};
