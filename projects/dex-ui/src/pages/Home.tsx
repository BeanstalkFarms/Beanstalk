import React from "react";
import { useAccount, useNetwork } from "wagmi";

export const Home = () => {
  const account = useAccount();
  const { chain } = useNetwork();
  return (
    <div>
      <h2>Home Page</h2>
      <div>
        <pre>
          {`
address: ${account.address}
chain: ${chain?.name}
status: ${account.status}
        `}
        </pre>
      </div>
    </div>
  );
};
