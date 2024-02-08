Committed: September 5, 2022

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/governance/beanstalk/bcm-process#emergency-response-procedures), an emergency hotfix may be implemented by an emergency vote of the BCM if the bug is minor and does not require significant code changes.

Note: Bugs or security vulnerabilities qualify as emergencies. Emergency action will not be taken for any reason related to the economic health of Beanstalk (like a bank run, for example).

## Links

* [Gnosis Transaction](https://gnosis-safe.io/app/eth:0xa9bA2C40b263843C04d344727b954A545c81D043/transactions/multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x41326a119cf437d901354904a2440236a294a4f2661b4bbc75289ecfc6528222)
* [Etherscan Transaction](https://etherscan.io/tx/0x0100d62959b09deea2cdccb8c14c5f9495778452d1d2fcda7f5da1a6cd6e9bec)
* [Arweave](https://arweave.net/w6AuMbl8nA30Oh7d8sfRIML4pVRj6jq23XlDvUlHQoI)

## Problem

The BCM has updated Beanstalk to remove the `chop()` function which was vulnerable. After searching for the `chop()` event, it appears that no one had called the `chop()` function yet. Therefore, the vulnerability was never exploited.

You can read more about the vulnerability in [Halborn's audit report of BIP-24](https://arweave.net/9CX_DCDceBugfmpHhxlL85gkCn-4Yu0eQQQsZ9ckY8w) on pages 15-18.

## Proposed Solution

Remove the `chop()` function until a new implementation can be sufficiently audited and re-added via BIP.

## Rationale

`chop()` is not a frequently used function, so it is acceptable for Beanstalk to remain operational and Unpaused while the `chop()` is unable to be called.

The `chop()` function will be re-added to the contract via an additional update as soon as possible and once Halborn has approved the fixes. 

## Effective

Immediately upon commit by the BCM, which has already happened.

## Functions to Change
- update `chop()` in `UnripeFacet`
