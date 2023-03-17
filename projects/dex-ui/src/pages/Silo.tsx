import React, { useEffect, useState } from "react";
import useSdk from "src/utils/sdk/useSdk";

export const Silo = () => {
  const sdk = useSdk();
  const [balances, setBalances] = useState(new Map());
  useEffect(() => {
    const load = async () => {
      const balances = await sdk.silo.getBalances();
      balances.get(sdk.tokens.BEAN_CRV3_LP);
      setBalances(balances);
    };

    sdk.signer && load();
    // @ts-ignore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk.signer]);

  const rows = [];

  for (let [key, val] of balances) {
    rows.push(
      <div key={key.symbol}>
        {key.symbol}: {val.deposited.amount.toHuman()}
      </div>
    );
  }

  return <div>{rows}</div>;
};
