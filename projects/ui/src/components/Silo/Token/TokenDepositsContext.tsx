import React, { createContext, useContext, useState } from 'react';

type ContextType = {
  deposits: Set<string>;
  toggleDeposit: (depositId: string) => void;
  clear: () => void;
};

const TokenDepositsContext = createContext<ContextType>({} as ContextType);

export const TokenDepositsProvider = (props: { children: React.ReactNode }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleDeposit = (depositId: string) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(depositId)) {
        copy.delete(depositId);
      } else {
        copy.add(depositId);
      }

      return copy;
    });
  };

  const clear = () => setSelected(new Set());

  return (
    <TokenDepositsContext.Provider
      value={{
        deposits: selected,
        toggleDeposit,
        clear,
      }}
    >
      {props.children}
    </TokenDepositsContext.Provider>
  );
};

export const useTokenDepositsContext = () => {
  const context = useContext(TokenDepositsContext);

  if (!context) {
    throw new Error(
      'useTokenDepositsContext must be used within a TokenDepositsProvider'
    );
  }

  return context;
};
