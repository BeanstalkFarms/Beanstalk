# How Swap Works

1. Create the SwapBuilder

   - `sdk.swapbuilder` is a singleton of SwapBuilder. Use only this one
     ```js
     const builder = sdk.swapBuilder;
     ```
   - add wells to it.
     ```js
     builder.addWell(well);
     ```
   - To see a visual graph of the routes: `console.log(builder.router.getGraphCode());`

2. Create a `Quote` object. This can be used multiple times to get quotes. For ex, when user changes amounts in a UI's input

   ```js
   const quoter = builder.buildQuote(token1, token2, recipient);
   ```

   This creates a quoter object that is bound to the inputs. This allows changing amounts w/o recalculating the route each time.

3. Get a quote

   ```js
   const quote = await quoter.quoteForward(token1.amount(100), recipient, slippage);

   // const { amount, doApproval, doSwap } = quote;
   ```

4. Execute it

   ```js
   if (doApproval) {
     const atx = await doApproval();
     await atx.wait();
   }

   const stx = await doSwap();
   await stx.wait();
   ```

# Behind the scenes

    - When you run `builder.buildQuote`, that's when a `Route` object is created.
    - Route object contains the steps needed to fulfill the swap, based on traversing the graph data strcuture that represents all the wells and their tokens. The steps are stored as an array of `RouteLeg`

### Quote

The `Quote` object is the heart of swapping, and it is used to get one or more quotes for the tokens it was built with. The tokens cannot be changed, a new Quote object must be created for different tokens.

Every time a quote is requested, the response will be a `QuoteResult`

```js
type QuoteResult = {
  amount: TokenValue,
  doSwap: () => Promise<ContractTransaction>,
  doApproval?: () => Promise<ContractTransaction>
};
```

The QuoteResult object will contain the quoted amounts as well as the methods to perform approval, if needed, and the swap.

#### Quote / Swap Flow

Swapping can take the following paths:

- Forward
  - Single Step
  - Multistep
    - no ETH involved
    - starts with ETH, so wrap ETH first
    - ends with ETH so unwrap WETH
- Reverse
  - Single Step
  - Multistep
    - no ETH involved
    - starts with ETH, so wrap ETH first
    - ends with ETH so unwrap WETH

Forward means selling, for ex, I want to spend 1 WETH, give me as many BEANS as possible.
Reverse means buying, for ex, I want to receive exactly 1000 BEANS, tell me the amount of WETH I need to spend.

Single step means we are swapping against only one well, ie, the in and out tokens belong to the same well. For ex, swapping WETH <> BEAN in a WETH_BEAN well

Multistep means we need to route through multiple wells, for ex, USDC > BEAN, going through the USDC_WETH well then through the WETH_BEAN well; two swaps.

In practice this means:

- Forward

  - Single Step:
    ```js
    well.swapFrom();
    ```
  - Multistep
    - no ETH involved
    ```js
    depot.farm([
        transferToFirstWell,
        depot.advancedPipe([
            shift,
            shift,
            shift,
            ...
        ])
    ])
    ```
    - starts with ETH, so wrap ETH first
    ```js
    depot.farm([
        depot.advancedPipe([
            wrapEth,
            transferWethToFirstWell,
            shift,
            shift,
            shift,
            ...
        ])
    ])
    ```
    - ends with ETH so unwrap WETH
    ```js
    depot.farm([
        depot.advancedPipe([
            // TODO
            ...
        ])
    ])
    ```

- Reverse
  - Single Step
  ```js
  well.swapFrom();
  ```
  - Multistep
    - Same process as Forward for swapping, but quoting is different

# Examples

Examples of these flows are implemented in projects/examples/dex/swaps.ts.

To see/test the flows in the raw form, you can see the examples here:
Root: projects/examples/dex/flows/

- Forward
  - Single Step - N/A
  - Multistep
    - no ETH involved - multi.ts
    - starts with ETH, so wrap ETH first - multi-wrap-eth.ts
    - ends with ETH so unwrap WETH - multi-unwrap-eth.ts
- Reverse
  - Single Step - N/A
  - Multistep
    - no ETH involved - multi-reverse.ts
    - starts with ETH, so wrap ETH first - multi-reverse-wrap-eth
    - ends with ETH so unwrap WETH - multi-reverse-unwrap-eth

# Notes

Unorganized notes:

### Slippage for reverse quotes

When doing a reverse quote that involves a multistep swap, the resulting quote amount does _not_ have slippage applied, however, all the steps prior to it, do. For ex:

WETH > DAI maybe involves
WETH > BEAN > USDC > DAI, so a reverse quote looks like this:

I want 100 DAI, how much WETH do I need to spend?

- USDC ? > 100 DAI = 100.006 USDC.
- Apply slippage to that, 100.006 \* 1.001 (.1 slippage) = 100.106006
- BEAN ? > 100.106006 DAI = 100.001202 USDC
- Apply slippage to usdc, so 100.001202 \* 1.001 = 100.1012032 BEAN
- WETH ? > 100.1012032 BEAN might quote 0.050000903012060272 BEAN.
  This is the result that quoter gives you. Without slippage applied at the ~~last~~ first step.
  **However, the transactions, `swap()` and `doApproval()` will attempt to work with this amount + slippage!! **
