Committed: November 15, 2022

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

In the case of EBIP-6, functionality that was removed in [EBIP-4](https://arweave.net/WE73eyNcrbkCSZBAQerylbQ8VAoPjD0HBhVM6-OARVg) and [EBIP-5](https://arweave.net/rihDlnrjmAlFHRmsR3OeP3svGXcxFy_h1dEb0akpylk) is reintroduced this EBIP.

## Links

- [GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/146)
- [Gnosis Transaction](https://app.safe.global/eth:0xa9bA2C40b263843C04d344727b954A545c81D043/transactions/tx?id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x488c125cb2c9c0fb06d11913e037a193423728075afed1c51f7e6d024e3f05a6)
- [Etherscan Transaction](https://etherscan.io/tx/0x7e0f3c0a574edb5658028ff0c8460d0d2ddbfd8cfb486b98ed7b10c7aa12b8d1)
- [Arweave](https://arweave.net/o0cB9SKHQq1y_KqIRZ8oK-xLjtSiTXuiT5dGmkwxygI)

## Problem

### EBIP-4 Problem

In `s.podOrders[id]`, the number of Pods Ordered is stored for the `id`s of the 3 remaining V1 Pod Orders. 

The `createPodOrder(...)`, `fillPodOrder(...)` and `cancelPodOrder(...)` functions were removed in [EBIP-4](https://arweave.net/WE73eyNcrbkCSZBAQerylbQ8VAoPjD0HBhVM6-OARVg).

### EBIP-5 Problem

The `transferTokenFrom(...)` function was removed in [EBIP-5](https://arweave.net/rihDlnrjmAlFHRmsR3OeP3svGXcxFy_h1dEb0akpylk).

## Solution

### EBIP-4 Solution

Update `s.podOrders[id]` for the `id`s of the 3 remaining V1 Pod Orders from the number of Pods Ordered to the number of Beans locked. Information about the 3 V1 Pod Orders is included below:

| Beans locked   | Price per Pod | Pods Ordered   | Order Id                                                              |
|:---------------|:--------------|:---------------|:----------------------------------------------------------------------|
| 10,491.929346  | 0.10          | 104,919.293460 | `0x6f668ae24be6e177f8584600dbffea6e07f260e08e21fa47792385913e786da3`  |
| 1.466423       | 0.001         | 1,466.423000   | `0xf47df2678d29e9d57c5e9ed5f8c990e71910918154a2ed6d5235718035d7d8b0`  | 
| 0.000380       | 0.01001       | 0.037962       | `0x186c6468ca4d3ce2575b9527fcf42cc3c86ab7cc915a550c9e84c5443691607a`  |

Re-add the `createPodOrder(...)`, `fillPodOrder(...)` and `cancelPodOrder(...)` functions.

Notably, because the whitehat from [EBIP-4](https://arweave.net/WE73eyNcrbkCSZBAQerylbQ8VAoPjD0HBhVM6-OARVg) returned the extra 9,228.946824 Beans they received from Cancelling their Pod Order to Beanstalk (see [return transaction](https://etherscan.io/tx/0x09ad148ba695a05d08fd0726b9927411f94eceede13a730d4550f52ce9dc5e7d)), no Beans need to be minted to Beanstalk as part of the fix.

### EBIP-5 Solution

Change `transferTokenFrom(...)` to `transferInternalTokenFrom(...)` and re-add the function to Beanstalk. This function always transfers with `INTERNAL` `fromMode`.

All fixes have been reviewed by Halborn.

## Contract Changes

### MarketplaceFacet

The following `MarketplaceFacet` is still part of Beanstalk:
* [`0x0c9F436FBEf08914c1C68fe04bD573de6e327776`](https://etherscan.io/address/0x0c9F436FBEf08914c1C68fe04bD573de6e327776#code)

The following functions are **added** to `MarketplaceFacet`:

| Name                       | Selector     | 
|:---------------------------|:-------------|
| `createPodOrder(...)`      | `0x82c65124` |
| `fillPodOrder(...)`        | `0x845a022b` |
| `cancelPodOrder(...)`      | `0xdf18a3ee` |

### TokenFacet

The following `TokenFacet` is still part of Beanstalk:
* [`0x8D00eF08775872374a327355FE0FdbDece1106cF`](https://etherscan.io/address/0x8D00eF08775872374a327355FE0FdbDece1106cF#code)

The following `TokenFacet` is being **added** to Beanstalk: 
* [`0x50eb0085C31dfa8CF86cA16DeF77520E762EAD4a`](https://etherscan.io/address/0x50eb0085C31dfa8CF86cA16DeF77520E762EAD4a#code)

With the following functions:

| Name                              | Selector     | 
|:----------------------------------|:-------------|
| `transferInternalTokenFrom(...)`  | `0xd3f4ec6f` |

## Effective

Effective immediately upon commit by the BCM, which has already happened.
