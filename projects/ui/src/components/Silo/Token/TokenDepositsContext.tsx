import React, {
  createContext,
  SyntheticEvent,
  useCallback,
  useContext,
  useState,
} from 'react';
import useTabs from '~/hooks/display/useTabs';
import { exists } from '~/util/UI';

export type TokenDepositsSelectType = 'single' | 'multi';

type SiloTokenSlug = 'token' | 'transfer' | 'lambda' | 'anti-lambda';

const SLUGS: SiloTokenSlug[] = ['token', 'transfer', 'lambda', 'anti-lambda'];

export type TokenDepositsContextType = {
  selected: Set<string>;
  slug: SiloTokenSlug;
  setSelected: (
    depositId: string,
    selectType: TokenDepositsSelectType,
    callback?: () => void
  ) => void;
  setSlug: (
    slug: SiloTokenSlug | undefined | null,
    callback?: () => void
  ) => void;
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

  const handleSetSelected = useCallback(
    (
      depositId: string,
      selectType: TokenDepositsSelectType,
      callback?: () => void
    ) => {
      const copy = new Set(selected);
      if (selectType === 'single') {
        const inSelected = copy.has(depositId);
        copy.clear();
        if (!inSelected) {
          copy.add(depositId);
        }
      } else if (!copy.delete(depositId)) {
        copy.add(depositId);
      }

      setSelected(copy);
      callback?.();
    },
    [selected]
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  const setSlug = useCallback(
    (action: SiloTokenSlug | undefined | null, callback?: () => void) => {
      callback?.();
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
        selected,
        slug: slugIndexMap[slugIndex],
        setSlug,
        setSelected: handleSetSelected,
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
