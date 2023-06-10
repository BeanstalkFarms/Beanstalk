import BigNumber from 'bignumber.js';

export type BeanNFTSupply = {
  amounts: {
    [key: string]: {
      totalSupply: BigNumber;
      minted: BigNumber;
    };
  };
};
