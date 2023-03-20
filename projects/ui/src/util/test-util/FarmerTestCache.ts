import {
  StepGenerator,
  TokenBalance,
  TokenSiloBalance,
  TokenValue,
  Token,
} from '@beanstalk/sdk';
import { FormTxn } from '../FormTxns';

export type FarmerTestCacheInterface = {
  steps: { [key in FormTxn]: StepGenerator[] };
  tokens: Map<Token, TokenBalance>;
  silo: Map<Token, TokenSiloBalance>;
  amounts: { [key: string]: TokenValue };
  ids: { [key: string]: string[] };
};

export default class FarmerTestCache {
  private cache: FarmerTestCacheInterface;

  constructor(_cache?: FarmerTestCacheInterface) {
    this.cache = _cache || FarmerTestCache.makeCache();
  }

  static makeCache() {
    return {
      steps: {
        [FormTxn.MOW]: [],
        [FormTxn.PLANT]: [],
        [FormTxn.ENROOT]: [],
        [FormTxn.CLAIM]: [],
        [FormTxn.HARVEST]: [],
        [FormTxn.RINSE]: [],
      },
      tokens: new Map(),
      silo: new Map(),
      amounts: {},
      ids: {},
    };
  }

  private cacheObjectMethods<T extends keyof FarmerTestCacheInterface>(k: T) {
    return {
      get: () => this.cache[k],
      set: (value: FarmerTestCacheInterface[T]) => {
        this.cache[k] = {
          ...this.cache[k],
          ...value,
        };
      },
      getValue: (key: keyof FarmerTestCacheInterface[T]) => this.cache[k][key],
      setValue: (
        key: keyof FarmerTestCacheInterface[T],
        value: FarmerTestCacheInterface[T][keyof FarmerTestCacheInterface[T]]
      ) => {
        this.cache[k][key] = value;
      },
    };
  }

  getCache(): FarmerTestCacheInterface {
    return this.cache;
  }

  public amounts = this.cacheObjectMethods('amounts');

  public ids = this.cacheObjectMethods('ids');

  public steps = this.cacheObjectMethods('steps');

  /// figure out a generic way to do this...
  public silo = {
    getValue: (tkn: Token) => this.cache.silo.get(tkn),
    setValue: (tkn: Token, balance: TokenSiloBalance) => {
      this.cache.silo.set(tkn, balance);
    },
    get: () => this.cache.silo,
    set: (map: Map<Token, TokenSiloBalance>) => {
      this.cache.silo = map;
    },
  };

  /// figure out a generic way to do this...
  public tokens = {
    getValue: (tkn: Token) => this.cache.tokens.get(tkn),
    setValue: (tkn: Token, balance: TokenBalance) => {
      this.cache.tokens.set(tkn, balance);
    },
    get: () => this.cache.tokens,
    set: (map: Map<Token, TokenBalance>) => {
      this.cache.tokens = map;
    },
  };
}
