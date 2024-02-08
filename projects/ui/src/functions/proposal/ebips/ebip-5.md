Committed: November 14, 2022

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability. 

This bug was reported by a whitehat on Immunefi.

## Links

- [Gnosis Transaction](https://app.safe.global/eth:0xa9bA2C40b263843C04d344727b954A545c81D043/transactions/tx?id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x344b2bde80d7290f5464adf35fce7fbd742520c68aa7f0aa9cb39a9a0411eaf7)
- [Etherscan Transaction](https://etherscan.io/tx/0x74f540497e7ee213ae0e3025d2c5dd5567372fdfebfd55adc7c55d8455318b5a)
- [Arweave](https://arweave.net/rqnIr_xLdEm4Q0ZiMqWh26lwvNmXUnMv9zu2Is4qOmM)

## Problem

In `transferTokenFrom(...)`, only the allowance for Farm (`INTERNAL`) balances from `msg.sender` was checked, not Circulating (`EXTERNAL`) balances. Therefore, anyone could successfully call the `transferTokenFrom(...)` function with `EXTERNAL` as `fromMode`, their own address as `recipient` and the address of a Farmer who had Circulating assets that were approved to be used by Beanstalk as `sender`.

### Funds at Risk

As of writing on November 15, 2022, the total funds at risk due to this vulnerability was about **$3,087,655 worth of assets**. This could have decreased or increased at any time based on the assets Farmers had in their Circulating balance that they had approved Beanstalk to use, or the value of the tokens themselves fluctuating.

Notably, **these were funds that were approved to be used by Beanstalk**. The number of Beans at risk roughly equates to the value that could have been removed from the BEAN:3CRV liquidity pool.

All dollar values in the following table are estimates.

|    Token    | Tokens at risk | Current value per token | Value at risk   |
|:------------|:---------------|:------------------------|:----------------|
| BEAN        | 537,582.5167   |  $1.0000                | $537,582.52     |
| WETH        | 14.19750283    |  $1,263.15              | $17,933.58      |
| 3CRV        | 29.24003397    |  $1.0165                | $29.72          |
| DAI         | 7,215.315006   |  $0.9999                | $7,214.59       |
| USDC        | 2,519,374.833  |  $1.0001                | $2,519,626.77   |
| USDT        | 5,170.245591   |  $0.9992                | $5,166.11       |
| BEAN3CRV LP | 0.4458259384   |  $1.00092*              | $0.45           |
| urBEAN      | 7.257246       |  $0.0054**              | $0.04           |
| urBEAN3CRV  | 18,909.8082    |  $0.0054**              | $102.11         |

*There's no liquid market for the BEAN3CRV LP token itself, so the current BDV is used to estimate the value.

**There's no liquid market for Unripe assets, so the Chop Penalty is used to estimate the value of these tokens.

## Solution

Remove the `transferTokenFrom(...)` function until a fix can be sufficiently reviewed.

## Contract Changes

### TokenFacet

The following `TokenFacet` is still part of Beanstalk:
* [`0x8D00eF08775872374a327355FE0FdbDece1106cF`](https://etherscan.io/address/0x8D00eF08775872374a327355FE0FdbDece1106cF#code)

The following functions are **removed** from `TokenFacet`:

| Name                       | Selector     | 
|:---------------------------|:-------------|
| `transferTokenFrom(...)`   | `0x7006e387` |

## Effective

Effective immediately upon commit by the BCM, which has already happened.
