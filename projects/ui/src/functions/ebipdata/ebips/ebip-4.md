Committed: November 12, 2022

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/governance/beanstalk/bcm-process#emergency-response-procedures), an emergency hotfix may be implemented by an emergency vote of the BCM if the bug is minor and does not require significant code changes.

This bug was reported by a whitehat on Immunefi.

## Links

- [Gnosis Transaction](https://app.safe.global/eth:0xa9bA2C40b263843C04d344727b954A545c81D043/transactions/tx?id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x1a54d4f9e50d0914e4dd9eccc42bdd453ca247045e1e7bbc9bc7123749fe7843)
- [Etherscan Transaction](https://etherscan.io/tx/0x1ad6991ad8251302989fe95853e2b0bdd8ed160eb0ed028a1332a92dc652b896)
- [Arweave](https://arweave.net/Eb3qBsLrBdMBGtyaR3lEhK1_r_tS0HvvCgRFmKroPM8)

## Problem

A bug regarding the backwards compatibility of V1 Pod Orders  was reported and the corresponding vulnerability was confirmed by the BIC. 

Cancelling V1 Pod Orders that were created before and Cancelled after BIP-29 was committed would return the number of Pods Ordered in Beans times the price per Pod, rather than the Beans initially locked in the V1 Pod Order. 

There were 4 outstanding V1 Pod Orders at the time that BIP-29 was committed. One of these V1 Pod Orders was Cancelled by the whitehat ([transaction here](https://etherscan.io/tx/0x644bd156eb9c3516cd363f40f5d21ee000e68aafcdd85598f1f304cc4acaea53)), returning them 10,254.38536 Beans instead of 1,025.438536 Beans.

### Funds at Risk

**The total funds at risk due to this vulnerability** (i.e., not including the Beans initially locked in the V1 Pod Orders, and including the additional Beans obtained by the whitehat) **was 105,121.305097 Beans**. Notably, only the respective addresses that created these V1 Pod Orders could have Cancelled them to take advantage of this vulnerability. 

| Beans locked   | Price per Pod | Pods Ordered   |Funds at Risk  | Order Id                                                              |
|:---------------|:--------------|:---------------|:--------------|:----------------------------------------------------------------------|
| 1,025.438536   | 0.10          | 10,254.385360  | 9,228.946824  | `0x0f6cc96e210a59fb6a349d46f8c9ec6d4077e05a8f59247a83f2f8a89a7adb43`  | 
| 10,491.929346  | 0.10          | 104,919.293460 | 94,427.364114 | `0x6f668ae24be6e177f8584600dbffea6e07f260e08e21fa47792385913e786da3`  |
| 1.466423       | 0.001         | 1,466.423000   | 1,464.956577  | `0xf47df2678d29e9d57c5e9ed5f8c990e71910918154a2ed6d5235718035d7d8b0`  | 
| 0.000380       | 0.01001       | 0.037962       | 0.037582      | `0x186c6468ca4d3ce2575b9527fcf42cc3c86ab7cc915a550c9e84c5443691607a`  |

## Solution

Remove the `createPodOrder(...)`, `fillPodOrder(...)` and `cancelPodOrder(...)` functions until a fix can be sufficiently reviewed.

## Contract Changes

### MarketplaceFacet

The following `MarketplaceFacet` is still part of Beanstalk:
* [`0x0c9F436FBEf08914c1C68fe04bD573de6e327776`](https://etherscan.io/address/0x0c9F436FBEf08914c1C68fe04bD573de6e327776#code)

The following functions are **removed** from `MarketplaceFacet`:

| Name                       | Selector     | 
|:---------------------------|:-------------|
| `createPodOrder(...)`      | `0x82c65124` |
| `fillPodOrder(...)`        | `0x845a022b` |
| `cancelPodOrder(...)`      | `0xdf18a3ee` |

## Effective

Effective immediately upon commit by the BCM, which has already happened.
