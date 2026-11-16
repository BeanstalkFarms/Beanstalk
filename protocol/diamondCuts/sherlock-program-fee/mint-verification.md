# Beanstalk Sherlock program fee mint

Unsigned Safe Transaction Builder batch for the Beanstalk Community Multisig on Arbitrum One (chain ID 42161). The batch deploys the existing Beanstalk `InitMint` implementation and calls Beanstalk to mint exactly **79,000 BEAN** to the Beanstalk Farms Multisig. Both calls carry zero ETH value and execute atomically through Safe MultiSendCallOnly.

## Calls

| Step | Target | Operation |
| --- | --- | --- |
| 1 | Deterministic deployment proxy `0x4e59b44847b379578588920cA78FbF26c0B4956C` | Deploy `InitMint` to `0xcf5A31288e178699c78D93E6f01efF7691b70D3F`. |
| 2 | Beanstalk `0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70` | Call `diamondCut([], initializer, initCalldata)`. The initializer calls the Arbitrum BEAN token at `0xBEA0005B8599265D41256905A9B3073D397812E4` to mint `79,000,000,000` base units to `0x390b023d316c2e92dd96A9bcC7fAe8dB12A2fBC1`. |

- **BCM Safe:** `0xDd5b31E73dB1c566Ca09e1F1f74Df34913DaaF69`
- **MultiSendCallOnly:** `0x9641d764fc13c8B624c04430C7356C1C7C8102e2`
- **CREATE2 salt:** `0x72ba3b2cdeb597fed9097076d7d6da70f63c7dca38b23b0626dbdbe9f224fe92`
- **Initializer creation bytecode hash:** `0x0c1134f1906de3950b8bd10858fa0b4d2b90bef4b04f4ee68ca8c9d5b980a24d`
- **Initializer runtime bytecode hash:** `0xa53af71e40f098d0b75d26ab9fc67a227843ae632090e38563e55258cd37b71c`
- **MultiSend calldata hash:** `0xbaae2d380ac9bd6bc2757fa59355c1ad47d710264a4973d392a52947da82f778`

The accompanying standard compiler input reproduces both initializer bytecodes with Solidity `0.8.25+commit.b61c2a91`.

## Verification

At [Arbitrum block 524,623,179](https://arbiscan.io/block/524623179), Beanstalk's owner was the BCM Safe, Beanstalk had BEAN's minter role, and the expected initializer address had no code. The encoded batch succeeded in the BCM's `simulateAndRevert` call. A second read-only simulation asserted that both total BEAN supply and the receiving multisig's BEAN balance increased by exactly **79,000 BEAN**. These checks do not exercise live Safe signatures, nonce selection, or any Safe transaction guard.

At the same block an exact-output quote for **12,003.252282 USDC**, sufficient for **$12,000 USD** at the observed rate, required **77,161.636923 BEAN** via BEAN → wstETH → WETH → USDC. The quote excludes execution gas. Recheck the full-size quote and confirmed invoice settlement instructions before signing the mint. Re-simulate the exact imported batch. If the initializer address already has code, verify its runtime hash and regenerate the batch without the deployment call. A mismatched runtime requires a new initializer address.

The batch covers the fee mint. The BFM sale, Sherlock payment, and any unused BEAN burn are separate BFM transactions. The existing Immunefi bounty funds move separately from the old multisig after confirming the replacement Safe and the transfer balance. The mint batch is unsigned and has not been submitted. The BCM must resolve the applicable governance route before execution. [BCM process](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures)
