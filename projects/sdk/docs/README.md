# Beanstalk SDK

This is a live, wip, design-doc/documentation of the Beanstalk SDK. It should be tweaked to just docs before releasing the SDK

## Library Exports

The following objects are available for import from the library:

```javascript
import {
  BeanstalkSDK,
  Utils,

  // classes & types
  ChainID, // ENUM of chain types
  NativeToken,
  ERC20Token,
  BeanstalkToken,
  Address
} from "@beanstalk/sdk";
```

TODO: add types and root classes (Token, Address, etc..) to export

## Using the SDK

Create an instance

```javascript
import { BeanstalkSDK } from "@beanstalk/sdk";

const sdk = new BeanstalkSDK(options);
```

SDK contructor options:

```javascript
const options = {
  // etherjs Signer. Optional
  signer,

  // etherjs Provider. Optional
  provider,

  // rpcUrl
  rpcUrl,

  // bool, print debug output. default `false`
  DEBUG
};
```

- `options` object is optional. If ommited, SDK will use an `ethers.getDefaultProvider()`
- If `rpcUrl` is provided, SDK will use a `WebSocketProvider` or `JsonRpcProvider`, depending on the protocol in the url (`ws` vs `http`)
- If `signer` is provided, `sdk.provider` will be set to `signer.provider`

## SDK properties and methods

- `sdk.chainId` - (type [ChainID](./ChainId.md#chainid)) is inferred from `sdk.provider.network.chainId` or defaults to `1`
- `sdk.addresses` - common [Addresses](#addresses) for contracts and tokens.
- `sdk.contracts` - all [Contracts](#contracts) used by Beanstalk
- `sdk.tokens` - all [Tokens](#tokens) used by Beanstalk
- `sdk.swap` - all functionality needed to perform [Swaps](#Swap)
- `sdk.farm` - Handle `farm()` mechanics in a nice way [Farm](#farm)
- `sdk.balances` - retrieve various [Balances](#balances)

TODO:

- `sdk.silo` - all funtionality needed to interact with the [Silo](#silo)

TBD:

- `sdk.field` - all funtionality needed to interact with the [Field](#field)
- `sdk.barn` - all funtionality needed to interact with the [Barn](#barn)
- `sdk.market` - all funtionality needed to interact with the [Market](#market)

## Addresses

The `sdk.addresses` object contains accessors to get chain addresses for various contracts and tokens. Each property is of type [Address](./Address.md).

```javascript
const addresses: {
    BEANSTALK: Address;
    BEANSTALK_PRICE: Address;
    BEANSTALK_FERTILIZER: Address;
    BARNRAISE_CUSTODIAN: Address;
    BEANFT_GENESIS: Address;
    BEANFT_WINTER_ADDRESSES: Address;
    BEAN: Address;
    UNRIPE_BEAN: Address;
    UNRIPE_BEAN_CRV3: Address;
    WETH: Address;
    DAI: Address;
    USDC: Address;
    USDT: Address;
    CRV3: Address;
    LUSD: Address;
    BEAN_CRV3: Address;
    POOL3: Address;
    TRICRYPTO2: Address;
    POOL_REGISTRY: Address;
    META_FACTORY: Address;
    CRYPTO_FACTORY: Address;
    CURVE_ZAP: Address;
    BEAN_ETH_UNIV2_LP: Address;
    BEAN_LUSD_LP: Address;
}
```

Example of getting an address on the currently connected chain.

**Note** - Address objects are not 'connected' to the SDK (sdk object is not dependency-injected) so they are not aware what the current chainId is. If you do not specify a chainId to the .get() method, you will get the MAINNET address by default, NOT the SDK's currently connected chain.

```javascript
const address = sdk.addresses.BEANSTALK.get(); // get MAINNET address
const address = sdk.addresses.BEANSTALK.get(sdk.chainId); // get address of chain that SDK is connected to
```

## Contracts

The `sdk.contracts` object contains references to all contacts used by Beanstalk. The shape of this property is simply how the contracts are organized for ease of use and discoverability.

- contracts are an `etherjs` contracted generated from typechain files using the `Name__factory.connect()` mechanism.
- contracts are already connected to `sdk.chainId`, ready to run.

Example:

```javascript
const balance = await sdk.contracts.beanstalk.balanceOfEarnedBeans(account);
```

Available contracts:

```javascript
sdk.contracts = {
  beanstalk: Beanstalk,
  curve: {
    pools: {
      pool3: Curve3Pool,
      tricrypto2: CurveTriCrypto2Pool,
      beanCrv3: CurveMetaPool,
      [k: string]: BaseContract   // allows getting a contract by address
    },
    registries: {
      poolRegistry: CurveRegistry,
      metaFactory: CurveMetaFactory,
      cryptoFactory: CurveCryptoFactory,
      [k: string]: BaseContract,  // allows getting a contract by address
    },
    zap: CurveZap,
  },
};
```

## Tokens

`sdk.tokens` object contains accessors to all supported tokens in Beanstalk. Each token is of type [Token](./Token.md)

```javascript
await sdk.tokens.BEAN.getBalance(account);
```

## Swaps

Peform token swaps. You must create a SwapOperation first, then you can run `.estimate()`, `.estimateReversed()`, or `.execute()` on it.

`const operation = sdk.swap.buildSwap(tokenIn, tokenOut, account, fromMode?, toMode?)`

- tokenIn: Token object you want to swap from
- tokenOut: Token object you want to convert to
- account: Where to send the tokens after the swap
- fromMode: Which balance to use, farm (INTERNAL) or circulating (EXTERNAL). optional, defaults to EXTERNAL
- toMode: To which balance to send the results, farm (INTERNAL) or circulating (EXTERNAL). optional, defaults to EXTERNAL
- returns: SwapOperation // TODO: link

`const est = operation.estimate(amount)`
Estimate how much 'tokenOut' you will receive given an 'amount' of 'tokenIn'.

- amount: The amount of tokens to get an estimate for
- returns: TokenValue // TODO: link

`const est = operation.estimateReversed(amount)`
Estimate how much 'tokenIn' you need that will result in an `amount` of 'tokenOut'.
For ex, if swapping from ETH to BEAN, `estimateReversed(5000)` will tell you how much ETH you need to execute the swap operation with.

- amount: The amount of "tokenOut" to get an estimate for
- returns: TokenValue // TODO: link

### Swap ETH to BEAN

```javascript
import { BeanstalkSDK, FarmFromMode, FarmToMode } from "@beanstalk/sdk";

const tokenIn = sdk.tokens.ETH;
const tokenOut = sdk.tokens.BEAN;
const account = await sdk.getAccount();
const fromMode = FarmFromMode.EXTERNAL;
const toMode = FarmToMode.INTERNAL;
const amountIn = tokenIn.fromHuman("3.14");

const swap = sdk.swap.buildSwap(tokenIn, tokenOut, account, fromMode, toMode);
const est = await swap.estimate(amountIn);

console.log(`Est $BEAN: ${est.toHuman()}`);

const txReceipt = await swap.execute(est, 0.1);
await txReceipt.wait();
```

### Swap ETH to BEAN with reversed estimate

```javascript
import { BeanstalkSDK, FarmFromMode, FarmToMode } from "@beanstalk/sdk";

const tokenIn = sdk.tokens.ETH;
const tokenOut = sdk.tokens.BEAN;
const account = await sdk.getAccount();
const fromMode = FarmFromMode.EXTERNAL;
const toMode = FarmToMode.INTERNAL;

const desiredAmountOut = tokenOut.fromHuman("5000");

const swap = sdk.swap.buildSwap(tokenIn, tokenOut, account, fromMode, toMode);
const est = await swap.estimateReversed(desiredAmountOut);

console.log(`Est $BEAN: ${est.toHuman()}`);

const txReceipt = await swap.execute(est, 0.1);
await txReceipt.wait();
```

## Balances

TODO

```javascript
sdk.balances.getStalk();
sdk.balances.getSeeds();
sdk.balances.getPods();
sdk.balances.getSprouts();

sdk.balances.getAll();
// {
//   deposited: { BEAN: 100, BEAN3CRV: 50, urBEAN: 0, urBEAN3CRV: 0, total: 150},
//   withdrawn: { BEAN: 100, BEAN3CRV: 50, urBEAN: 0, urBEAN3CRV: 0, total: 150},
//   claimable: { BEAN: 100, BEAN3CRV: 50, urBEAN: 0, urBEAN3CRV: 0, total: 150},
//   farm: { BEAN: 100, BEAN3CRV: 50, urBEAN: 0, urBEAN3CRV: 0, total: 150},
//   circulating: { BEAN: 100, BEAN3CRV: 50, urBEAN: 0, urBEAN3CRV: 0, total: 150},
// }

sdk.balances.getDeposited();
//  { BEAN: 100, BEAN3CRV: 50, urBEAN: 0, urBEAN3CRV: 0, total: 150}
sdk.balances.getWithdraw();
sdk.balances.getClaimable();
sdk.balances.getFarm();
sdk.balances.getCirculating();
```

## Silo

TODO

```javascript
sdk.silo.deposit();
sdk.silo.convert();
sdk.silo.transfer();
sdk.silo.withdraw();
sdk.silo.getWithdrawals();
```

## Farm

TODO

```javascript
  const workflow =  new sdk.farm.WorkflowBuilder()
  workflow.addStep(workflow.library.swapETH_TO_BEAN(...))

  // or more manuall
  workflow.addStep(workflow.library.swapWETH_TO_USDT(...))
  workflow.addStep(workflow.library.swapUSDT_TO_BEAN(...))

  // or lowest level
  workflow.addStep(workflow.library.exchange(...))
  workflow.addStep(workflow.library.exchangeUnderlying(...))

  workflow.addStep(workflow.library.deposit(...))

  const estimate = await workflow.estimate()
  const tx = await workflow.execute();
```

The SDK could also provide a library of pre-build workflows

```javascript

  // swap ETH to WETH
  // swap WETH to USDT
  // addLiquidity(USDT)
  // deposit LP in silo
  const tx = await sdk.farm.workflowLibrary.ETH_TO_SILOLP(...)

  // and some of these can be exposed at a higher level:
  const tx = await sdk.silo.depositLPFromToken(token, amountIn)

```

## Field

TBD

```javascript
sdk.field.getAvailableSoil();
sdk.field.getTemperature();
sdk.field.getPodline();
sdk.field.podsHarvested();

sdk.field.sow();
sdk.field.transfer();
sdk.field.harvest();

sdk.getPlots();
```

## Barn

TBD

## Market

TBD
