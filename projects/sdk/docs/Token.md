## Token

A utility class for handling tokens. Token is a baseclass used by the following:

- `BeanstalkToken` - for internal tokens with no ERC20; ex Seed and Stalk
- `ERC20Token` - standard ERC20 token
- `NativeToken` - for representing chain native token that isn't an ERCO20; ex ETH or AVAX or MATIC

```javascript
new ERC20Token(sdk, '0x123', 18, { symbol: 'FOO' });
new NativeToken(sdk, null, 18, { symbol: 'ETH' });
```

Constructor options:

```typescript
type TokenConstructor = {
  new (
    sdk: BeanstalkSDK,
    address: string,
    decimals: number,
    metadata: {
      name?: string;
      symbol: string;
      logo?: string;
      color?: string;
      displayDecimals?: number;
      isLP?: boolean;
      isUnripe?: boolean;
    },
    rewards?: {
      stalk: number;
      seeds: number;
    }
  ): Token;
};
```

Methods:
- TODO

TODO:
- we need some solid value handling utilities.


[Back](./README.md)