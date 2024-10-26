import {
  Deposit,
  ERC20Token,
  TokenSiloBalance,
  TokenValue,
} from '@beanstalk/sdk';
import React, {
  createContext,
  SyntheticEvent,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import useTabs from '~/hooks/display/useTabs';
import useFarmerSiloBalanceSdk from '~/hooks/farmer/useFarmerSiloBalanceSdk';
import { exists } from '~/util/UI';

export type TokenDepositsSelectType = 'single' | 'multi';

export type SiloTokenSlug = 'token' | 'transfer' | 'lambda' | 'anti-lambda';

export interface UpdateableDeposit<T> extends Deposit<T> {
  newBDV: T;
}

export interface UpdatableSiloDeposit extends Deposit<TokenValue> {
  key: string;
  currentBDV: TokenValue;
  deltaBDV: TokenValue;
  deltaStalk: TokenValue;
  deltaSeed: TokenValue;
}

export type UpdatableDepositsByToken = Record<string, UpdatableSiloDeposit>;

export type TokenDepositsContextType = {
  selected: Set<string>;
  token: ERC20Token;
  slug: SiloTokenSlug;
  balances: TokenSiloBalance<TokenValue> | undefined;
  depositsById: Record<string, Deposit<TokenValue>>;
  setSelected: (
    depositId: string,
    selectType: TokenDepositsSelectType,
    callback?: () => void
  ) => void;
  setWithIds: (depositIds: string[]) => void;
  setSlug: (
    slug: SiloTokenSlug | undefined | null,
    callback?: () => void
  ) => void;
  clear: () => void;
};

const SLUGS: SiloTokenSlug[] = ['token', 'transfer', 'lambda', 'anti-lambda'];

const slugIndexMap: Record<number, SiloTokenSlug> = {
  0: 'token',
  1: 'transfer',
  2: 'lambda',
  3: 'anti-lambda',
} as const;

const TokenDepositsContext = createContext<TokenDepositsContextType | null>(
  null
);

// This could probably be refactored for less duplicated code
export const TokenDepositsProvider = (props: {
  children: React.ReactNode;
  token: ERC20Token;
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [slugIndex, setSlugIndex] = useTabs(SLUGS, 'content', 0);

  const siloBalances = useFarmerSiloBalanceSdk(props.token);

  const depositMap = useMemo(() => {
    const map: Record<string, Deposit<TokenValue>> = {};
    (siloBalances?.deposits || []).forEach((deposit) => {
      map[deposit.id.toString()] = deposit;
    });

    return map;
  }, [siloBalances?.deposits]);

  const handleSetSelected = useCallback(
    (
      depositId: string,
      selectType: TokenDepositsSelectType,
      callback?: () => void
    ) => {
      const copy = new Set([...selected]);
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

  const handleSetMulti = useCallback((depositIds: string[]) => {
    setSelected(new Set(depositIds));
  }, []);

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
        token: props.token,
        balances: siloBalances,
        depositsById: depositMap,
        slug: slugIndexMap[slugIndex] || 'token',
        setSlug,
        setSelected: handleSetSelected,
        setWithIds: handleSetMulti,
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
