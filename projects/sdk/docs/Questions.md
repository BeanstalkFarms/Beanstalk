## Open Questions

- Should we allow users to define/use chainids beyond the ones used by Beanstalk?

- Token class should have utilities for handling values, amounts, conversions, formatting and display. Discussion needed.
  4 formats:
- Human: "2.31" (typed into an input)
- Blockchain: 2310000000000000000
- bignumber (ethrs)
- bignumberjs chain form

  ```javascript
  toBaseUnitBN(new BigNumber('3.14'), 18)

  3140000000000000000
  {
    s: 1,
    e: 18,
    c: [ 31400 ],
  }
  ```

- bignumber human form

  ```javascript
  toTokenUnitsBN(new BigNumber("3140000000000000000"), 18);
  3.14
  {
    s: 1,
    e: 0,
    c: [ 3, 14000000000000 ],
  }
  ```

- SDK should use, and expose, only one big number library. bignubmerjs or BigNumber from ethers. If the ethersBN is needed (for ex, at lower level contracts) it should be abstracted, wrapped, and hidden as much as possible.

- is UI code, and thus SDK, audited? do we need to account for that in any timelines?
