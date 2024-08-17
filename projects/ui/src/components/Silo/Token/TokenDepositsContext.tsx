import React, {
  createContext,
  SyntheticEvent,
  useCallback,
  useContext,
  useState,
} from 'react';
import useTabs from '~/hooks/display/useTabs';
import { exists } from '~/util/UI';

type SiloTokenSlug = 'token' | 'transfer' | 'lambda' | 'anti-lambda';
const SLUGS: SiloTokenSlug[] = ['token', 'transfer', 'lambda', 'anti-lambda'];

type TokenDepositsContextType = {
  deposits: Set<string>;
  slug: SiloTokenSlug;
  toggleDeposit: (depositId: string) => void;
  setSlug: (slug: SiloTokenSlug | undefined | null) => void;
  clear: () => void;
};

const slugIndexMap: Record<number, SiloTokenSlug> = {
  0: 'token',
  1: 'transfer',
  2: 'lambda',
  3: 'anti-lambda',
} as const;

const TokenDepositsContext = createContext<TokenDepositsContextType | null>(
  null
);

export const TokenDepositsProvider = (props: { children: React.ReactNode }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [slugIndex, setSlugIndex] = useTabs(SLUGS, 'content', 0);

  const toggleDeposit = useCallback(
    (depositId: string) => {
      const copy = new Set(selected);
      if (copy.has(depositId)) {
        copy.delete(depositId);
      } else {
        copy.add(depositId);
      }
      setSelected(copy);
    },
    [selected]
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  const setSlug = useCallback(
    (action: SiloTokenSlug | undefined | null) => {
      if (exists(action)) {
        const index = SLUGS.indexOf(action as SiloTokenSlug);
        if (index > -1) {
          setSlugIndex({} as SyntheticEvent, index);
          return;
        }
      }

      setSlugIndex({} as SyntheticEvent, 0);
    },
    [setSlugIndex]
  );

  return (
    <TokenDepositsContext.Provider
      value={{
        deposits: selected,
        slug: slugIndexMap[slugIndex],
        setSlug,
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
