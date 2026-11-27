Executed on November 22, 2026 at 00:58:36 UTC.

## Submitter

[Beanstalk Community Multisig (BCM)](https://docs.bean.money/almanac/protocol/glossary#beanstalk-community-multisig).

## Summary

1. **Bug bounty migration.** Move Beanstalk’s Immunefi program to Sherlock under substantially similar terms, with targeted amendments based on experience operating the Immunefi program. Transfer the existing bounty funds to a new Beanstalk multisig designated for Sherlock program payouts.
2. **Sherlock program fee.** Mint **79,000** [**Beans**](https://docs.bean.money/almanac/protocol/glossary#bean) on Arbitrum One to `0xEEd9BCBE19bCFB43C04cBa2c40B497f3b0fCAE3D` to fund Sherlock’s **$12,000 USD** fee.

## Links

- [Sherlock program draft](https://audits.sherlock.xyz/protocol/bug-bounties/ntXEy6Wohkn5MswtNuu407LkYcPwgyjT)
- [Safe mint transaction, nonce 11](https://app.safe.global/transactions/tx?id=multisig_0xDd5b31E73dB1c566Ca09e1F1f74Df34913DaaF69_0x0bff467bac67727e749e049c23b4f0ff13b35112c26018ad5dde4c4b159a0a41&safe=arb1:0xDd5b31E73dB1c566Ca09e1F1f74Df34913DaaF69)
- [Arbitrum execution transaction](https://arbiscan.io/tx/0x31e1f3fb5aff4183466ae8e71bbc6c65267b13352c54a9fbf219c80f9f2e10e7)
- [Transaction package and verification notes](https://github.com/BeanstalkFarms/Beanstalk/tree/review/sherlock-bbp-fee-mint/protocol/diamondCuts/sherlock-program-fee)
- [Prior Immunefi program](https://immunefi.com/bug-bounty/beanstalk/information/)
- [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures)

## Problems

### 1. Bug bounty migration

Beanstalk’s Immunefi program has been shut down. The existing bounty funds are held by the [Beanstalk Immunefi Committee Multisig (BICM)](https://docs.bean.money/almanac/governance/beanstalk/bicm-dashboard) and need to be moved to the wallet that will handle researcher payouts under the Sherlock program.

### 2. Sherlock program fee

Sherlock charges **$12,000 USD** to operate the program. The existing bounty funds are allocated to researcher rewards, and the provider fee requires separate funding.

## Solutions

### 1. Bug bounty migration

Launch the program on Sherlock under substantially similar terms, with targeted amendments based on lessons from the Immunefi program. The BICM will transfer the existing bounty funds to the new Beanstalk multisig designated for Sherlock program payouts. Publish the final program terms, the new multisig address, and the transfer transaction.

### 2. Sherlock program fee

Mint **79,000 Beans** to `0xEEd9BCBE19bCFB43C04cBa2c40B497f3b0fCAE3D` on Arbitrum One. The recipient will sell the Beans and settle the verified invoice.

## Rationale

### 1. Bug bounty migration

Moving to Sherlock maintains a channel for vulnerability reports and triage. Keeping substantially similar terms gives researchers continuity while allowing Beanstalk to address issues encountered during the Immunefi program. Moving the existing bounty funds preserves the allocation for researcher rewards. Migrating to Sherlock is reflective of the better quality of their bug bounty program compared to Immunifi over the past year (the Pinto program has been on Sherlock).

### 2. Sherlock program fee

A dedicated mint funds the provider fee while preserving the researcher reward allocation. The Sherlock program is significantly cheaper than the Immunifi program.

## Contract Changes

The prepared Safe batch contains two calls, both carrying zero ETH value.

| Step | Target | Action |
| --- | --- | --- |
| 1 | [Deterministic deployment proxy](https://arbiscan.io/address/0x4e59b44847b379578588920cA78FbF26c0B4956C) | Deploy `InitMint` at `0xcf5A31288e178699c78D93E6f01efF7691b70D3F`. |
| 2 | [Beanstalk](https://arbiscan.io/address/0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70) | Call `diamondCut` with an empty facet cut and initializer calldata specifying the Arbitrum BEAN token, recipient `0xEEd9BCBE19bCFB43C04cBa2c40B497f3b0fCAE3D`, and `79,000,000,000` base units. |

Safe batches these calls atomically through [MultiSendCallOnly 1.3.0](https://arbiscan.io/address/0x40A2aCCbd92BCA938b02010E17A5b8929b49130D). The initializer creates **79,000 BEAN** at the recipient address. The mint batch, compiler input, and simulation evidence are in the linked transaction package.

The existing bounty-fund transfer and the sale and payment are separate transactions.

## Beans Minted

**79,000 Beans** (`79,000,000,000` base units).

## Effective

The mint takes effect upon BCM execution on Arbitrum One.

