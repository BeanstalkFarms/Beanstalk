import { getDefaultProvider } from "ethers";
import { createClient } from "wagmi";

export const client = createClient({
  autoConnect: true,
  provider: getDefaultProvider()
});
