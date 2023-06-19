# Cyfrin Code Review (DRAFT - THIS IS A WORK IN PROGRESS AND IS NOT COMPLETE)

| Title         | Details                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| Date          | 2023-06-13                                                                                   |
| Author        | [Patrick Collins](https://twitter.com/patrickalphac)                                         |
| Reviewer      | [Giovanni Di Siena](https://twitter.com/giovannidisiena)                                     |
| Repo          | [Beanstalk Core](https://github.com/BeanstalkFarms/Beanstalk)                                |
| Commit Hash   | `5b978351d9f8d3a824ffa157557139da8b1a6db0`                                                   |
| Area of Focus | [PR #410 for the `protocol` dir](https://github.com/BeanstalkFarms/Beanstalk/pull/410/files) |

## Contents

- [Cyfrin Code Review (DRAFT - THIS IS A WORK IN PROGRESS AND IS NOT COMPLETE)](#cyfrin-code-review-draft---this-is-a-work-in-progress-and-is-not-complete)
  - [Contents](#contents)
  - [About this PR](#about-this-pr)
  - [Disclaimer](#disclaimer)
  - [Security](#security)
  - [Code Quality](#code-quality)
  - [Documentation Experience](#documentation-experience)
  - [Developer Experience](#developer-experience)
    - [Our PR with this code review](#our-pr-with-this-code-review)
  - [Appendix](#appendix)
    - [Appendix 1 - Slither Output](#appendix-1---slither-output)
    - [Appendix 2 - 4naly3er Output](#appendix-2---4naly3er-output)
    - [Appendix 3 - Coverage](#appendix-3---coverage)

## About this PR

PR #410 aka Silo V3 contains the following upgrades:

- Withdrawal Freeze Removal
- Seeds per BDV Upgrades
- ERC-1155 Deposits
- Other `SiloFacet` changes

## Disclaimer

This document represents feedback from a formal code review, emphasizing suggestions to improve Developer Experience, Code Quality, Gas Optimization, and common Security pitfalls. It does not represent a security audit nor an endorsement of the underlying business or product, and the code review was time-boxed to 4 days.

The aim of this code review is to review the PR for Silo V3, aka BIP-36, aka [PR #410](https://github.com/BeanstalkFarms/Beanstalk/pull/410/files).

## Security

- Running the forking test suite makes a _lot_ of RPC calls, and takes a long time. This could potentially be a security issue if developers fail to finish running all the tests. Consider moving test suite to Foundry to speed up the process.
- Versioning of codebase should be the same throughout, consider using `pragma solidity =0.7.6;` for all files.
- Their are several `high` confidence and `high` severity rating outputs from static analysis tools, linked at the appendix. You can tell slither to ignore them but adding `//slither-disable-next-line DETECTOR_NAME` above the line that is causing the issue. We recommend addressing them **after making sure they are not needed.**

```bash
yarn npm audit
➤ YN0001: No audit suggestions
```

## Code Quality

- Indexers use events to monitor the state of the system, when an event's ABI changes, this can "break" the way the indexer is collecting data. [AddDeposit](https://github.com/BeanstalkFarms/Beanstalk/blob/5b978351d9f8d3a824ffa157557139da8b1a6db0/protocol/contracts/libraries/Silo/LibTokenSilo.sol#L54) is updating from a season ID to a stem ID, which can cause indexers to be confused. It might be worth renaming the event, or at least calling out in the developer documentation how an indexer can keep track of the new seasons based on the block number (indexing season update transactions).
- Use of `experimental ABIEncoderV2` in `Bean.t.sol` is not required as this was added in solidity 0.7.4. You can use `abicoder v2` instead of `experimental ABIEncoderV2`.
- There are _many_ commented out chunks of code, TODOs, and seemingly "unfinished" tests and pieces of code, such as [here](https://github.com/BeanstalkFarms/Beanstalk/blob/5b978351d9f8d3a824ffa157557139da8b1a6db0/protocol/test/Stem.test.js#L326), [protocol/test/Root.test.js](https://github.com/BeanstalkFarms/Beanstalk/blob/5b978351d9f8d3a824ffa157557139da8b1a6db0/protocol/test/Root.test.js), and others.
- `yarn format` is not a commit hook, and files are not all formatted systemically. Consider adding a commit hook to format all files before committing. We formatted at least `hardhat.config.js` for you.
- Consider using named imports over generalized ones to ensure you're importing what you need, and know where keywords are coming from:

❌ Change

```
import "contracts/C.sol";
```

✅ To

```
import {C} from "contracts/C.sol";
```

- Coverage is ~`71.96%` for all files. This isn't desirable. Granted, a lot of the files are one-off scripts like the `initbips` contracts and are ok to ignore, however it is concerning to see important contracts such as `Sun.sol` only have a 50% test coverage, or `FieldFacet.sol` with 22%.
- Improvements like [this](https://github.com/BeanstalkFarms/Beanstalk/blob/5b978351d9f8d3a824ffa157557139da8b1a6db0/protocol/contracts/libraries/Silo/LibUnripeSilo.sol#L64) where additional natspec and newer syntatic sugar is used are great additions in this PR.

## Documentation Experience

Due to the complex nature of this project, we additionally have a few suggestions for improving the [documentation experience](https://docs.bean.money/almanac/). This is a somewhat opinionated review as people come from different levels of financial experience backgrounds.

- The [How Beanstalk Works](https://docs.bean.money/almanac/introduction/how-beanstalk-works) should get people to the "aha" moment, and it does not.
  - The most important question is "How does the price of BEAN stay stable?". This should be the #1 question answered.
  - Concepts should be introduced first, and then what they are called in the beanstalk system. Introducing the terms first makes learning the system very difficult.
  - Here are some potential suggested improvements for the "How Beanstalk works".

```
Beanstalk does not have any collateral requirements. Instead, the follow architecture at a high level explains how BEAN stays pegged to $1.

# Overview

1. The price of a BEAN is monitored recorded by an [Oracle whitelist](https://docs.bean.money/almanac/farm/sun#oracle-whitelist), which right now is just a [BEAN:3CRV](https://curve.fi/#/ethereum/pools/factory-v2-152/deposit/) pool on Curve.

This is how the Beanstalk system always knows what the market rate of 1 BEAN is.

2. The system enables mechanisms to increase/decrease the supply of BEAN based on if the price is too low or too high.

### If the price of BEAN is too low (based on #1), the system will:
- Incentivize users to burn BEAN (decrease the BEAN supply)
- Incentivize users to remove BEAN from circulating supply (decreasing the BEAN circulating supply)

### If the price of BEAN is too high, the system will:
- Mint more BEANs (increase the BEAN supply)
- Incentivize users to add BEAN to circulating supply (increasing the BEAN circulating supply)

It's these mechanisms that keep the price of BEAN stable.

## Get the price of BEAN

<add specific stuff here, like deltaB, the sun, etc. Introduce the concept, and then the label you have for it. For example, you could say something like "The Beanstalk system doesn't take a single snapshot of the price, instead it takes a time and liquidity weighted average of excess or shortage of BEANs. This known as *deltaB*">s

## If the price of BEAN is too low

<add specific stuff about soil & temperature here. Introduce the concept, and then the name for it. For example "If the BEAN price is too low, the system will incentivize users to burn bean. The incentive Beanstalk uses, is by allowing BEAN holders to burn BEAN in exchange for more BEAN in the future. This is similar to a bond, or a fixed-income product. These promises for more BEANs in the future are known as "pods" and how many pods beanstalk is willing to create is known as "soil"." You can link off to each terms for users to go more into specifics about that concept.>

<also add the convert stuff>

## If the price of BEAN is too high

<now that you've introduced the mechanics, this section becomes easier, just name the reverse of the above>
```

- Ordering:
  - The ordering of the docs should be:
  - Introduction - Farmers' Almanac - Why Beanstalk - How Beanstalk Works
    Instead of what it currently is. This way users can go in conceptual order. 1. What is this? 2. Why do we need this? 3. How does it work?
- Just a note, we [categorize stablecoins](https://patrickalphac.medium.com/what-is-a-stablecoin-but-actually-186b81e545cd) into 3 categories, and it was interesting to [compare to your categorizations](https://docs.bean.money/almanac/advanced/stablecoin-overview#stablecoin-features)!
- The inclusion of Publius' audio walking through different sections is a nice touch.

## Developer Experience

- Add a prerequisites section in `DEVELOPER.md`
  - Your `DEVELOPER.md` file should include everything for any 3rd party to help contribute to your project. One of the first things you should answer is "what do I need to get started with this?". For Beanstalk, they will need:
    - [yarn](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable)
    - [foundry](https://book.getfoundry.sh/getting-started/installation)
  - A successful `DEVELOPER.md`/`README.md`/`CONTRIBUTING.md` file should include at least the following:
    - Getting Started
      - Prerequisites/Requirements
      - Installation/Setup
      - Quickstart
  - You can see an example of a [stellar readme here](https://github.com/othneildrew/Best-README-Template)
- Add running `yarn` as a setup step in `DEVELOPER.md`
- Use `yarn` instead of `npm install` for `protocol`
  - `npm install` doesn't work well with `yarn workspace`
- Make sure to include setting a `FORKING_URL` environment variable in `./protocol/README.md`
- In `Testing a BIP` instead of a number of manual steps, you could create an environment variable flag like `BIP_TEST=True` and check for it in the `hardhat.config.js`, and automatically apply the changes desired. This would make it easier for a developer to test a BIP.

### Our PR with this code review

In this code review, we have [included a draft PR](https://github.com/BeanstalkFarms/Beanstalk/pull/492/files) with our suggested changes to `DEVELOPER.md`, and a few other files. These are just suggestions so please take them as such.

## Appendix

### Appendix 1 - [Slither](https://github.com/crytic/slither) Output

Input:

```
cd Beanstalk/protocol
yarn compile
slither . --compile-force-framework hardhat --hardhat-ignore-compile --disable-color > slither-output.txt 2>&1
```

You can view the full output at [`slither-output.txt`](./protocol/slither-output.txt).

However, we wanted to draw attention to the results that have a `high` confidence and `high` severity rating. We recommend addressing them and labelling sections with `//slither-disable-next-line DETECTOR_NAME` if you choose to ignore them.

Output:

```
INFO:Detectors:
LibTransfer.transferToken(IERC20,address,address,uint256,LibTransfer.From,LibTransfer.To) (contracts/libraries/Token/LibTransfer.sol#30-46) uses arbitrary from in transferFrom: token.safeTransferFrom(sender,recipient,amount) (contracts/libraries/Token/LibTransfer.sol#40)
LibTransfer.receiveToken(IERC20,uint256,address,LibTransfer.From) (contracts/libraries/Token/LibTransfer.sol#48-71) uses arbitrary from in transferFrom: token.safeTransferFrom(sender,address(this),amount - receivedAmount) (contracts/libraries/Token/LibTransfer.sol#66)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#arbitrary-from-in-transferfrom
INFO:Detectors:
LibEth.refundEth() (contracts/libraries/Token/LibEth.sol#16-26) sends eth to arbitrary user
        Dangerous calls:
        - (success) = msg.sender.call{value: address(this).balance}(new bytes(0)) (contracts/libraries/Token/LibEth.sol#21-23)
LibWeth.unwrap(uint256,LibTransfer.From) (contracts/libraries/Token/LibWeth.sol#24-29) sends eth to arbitrary user
        Dangerous calls:
        - (success) = msg.sender.call{value: amount}(new bytes(0)) (contracts/libraries/Token/LibWeth.sol#27)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#functions-that-send-ether-to-arbitrary-destinations
INFO:Detectors:
MockSeasonFacet.resetState() (contracts/mocks/mockFacets/MockSeasonFacet.sol#163-190) uses a weak PRNG: "s.season.timestamp = uint32(block.timestamp % 2 ** 32) (contracts/mocks/mockFacets/MockSeasonFacet.sol#184)"
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#weak-PRNG
INFO:Detectors:
FarmFacet._farm(bytes) (contracts/beanstalk/farm/FarmFacet.sol#81-87) uses delegatecall to a input-controlled function id
        - (success,result) = facet.delegatecall(data) (contracts/beanstalk/farm/FarmFacet.sol#85)
FarmFacet._farmMem(bytes) (contracts/beanstalk/farm/FarmFacet.sol#90-96) uses delegatecall to a input-controlled function id
        - (success,result) = facet.delegatecall(data) (contracts/beanstalk/farm/FarmFacet.sol#94)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#controlled-delegatecall
INFO:Detectors:
FarmFacet._farm(bytes) (contracts/beanstalk/farm/FarmFacet.sol#81-87) has delegatecall inside a loop in a payable function: (success,result) = facet.delegatecall(data) (contracts/beanstalk/farm/FarmFacet.sol#85)
FarmFacet._farmMem(bytes) (contracts/beanstalk/farm/FarmFacet.sol#90-96) has delegatecall inside a loop in a payable function: (success,result) = facet.delegatecall(data) (contracts/beanstalk/farm/FarmFacet.sol#94)
Depot.farm(bytes[]) (contracts/depot/Depot.sol#43-54) has delegatecall inside a loop in a payable function: (success,result) = address(this).delegatecall(data[i]) (contracts/depot/Depot.sol#50)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation/#payable-functions-using-delegatecall-inside-a-loop
INFO:Detectors:
I3Curve is re-used:
        - I3Curve (contracts/interfaces/ICurve.sol#51-53)
        - I3Curve (contracts/mocks/curve/MockCurveFactory.sol#17-19)
        - I3Curve (contracts/mocks/curve/MockPlainCurve.sol#17-19)
SafeCast is re-used:
        - SafeCast (node_modules/@openzeppelin/contracts/utils/SafeCast.sol#21-211)
        - SafeCast (node_modules/@uniswap/v3-core/contracts/libraries/SafeCast.sol#6-28)
IERC165 is re-used:
        - IERC165 (node_modules/@openzeppelin/contracts/introspection/IERC165.sol#14-24)
        - IERC165 (contracts/interfaces/IERC165.sol#4-12)
IERC1155Receiver is re-used:
        - IERC1155Receiver (node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol#10-57)
        - IERC1155Receiver (contracts/interfaces/IERC1155Receiver.sol#11-58)
Oracle is re-used:
        - Oracle (node_modules/@uniswap/v3-core/contracts/libraries/Oracle.sol#11-325)
        - Oracle (contracts/beanstalk/sun/SeasonFacet/Oracle.sol#14-38)
IBS is re-used:
        - IBS (contracts/beanstalk/init/InitBip12.sol#15-17)
        - IBS (contracts/beanstalk/init/InitBip16.sol#15-18)
        - IBS (contracts/beanstalk/init/InitBip5.sol#15-17)
        - IBS (contracts/beanstalk/init/InitFundraiser.sol#15-17)
        - IBS (contracts/beanstalk/init/InitWhitelist.sol#16-26)
        - IBS (contracts/mocks/mockFacets/MockFundraiserFacet.sol#15-17)
        - IBS (contracts/tokens/Fertilizer/Fertilizer.sol#13-18)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#name-reused
INFO:Detectors:
Reentrancy in Order._createPodOrder(uint256,uint24,uint256,uint256) (contracts/beanstalk/market/MarketplaceFacet/Order.sol#56-72):
        External calls:
        - _cancelPodOrder(pricePerPod,maxPlaceInLine,minFillAmount,LibTransfer.To.INTERNAL) (contracts/beanstalk/market/MarketplaceFacet/Order.sol#67)
                - returndata = address(token).functionCall(data,SafeERC20: low-level call failed) (node_modules/@openzeppelin/contracts/token/ERC20/SafeERC20.sol#69)
                - LibTransfer.sendToken(C.bean(),amountBeans,msg.sender,mode) (contracts/beanstalk/market/MarketplaceFacet/Order.sol#158)
                - (success,returndata) = target.call{value: value}(data) (node_modules/@openzeppelin/contracts/utils/Address.sol#119)
                - token.safeTransfer(recipient,amount) (contracts/libraries/Token/LibTransfer.sol#82)
        External calls sending eth:
        - _cancelPodOrder(pricePerPod,maxPlaceInLine,minFillAmount,LibTransfer.To.INTERNAL) (contracts/beanstalk/market/MarketplaceFacet/Order.sol#67)
                - (success,returndata) = target.call{value: value}(data) (node_modules/@openzeppelin/contracts/utils/Address.sol#119)
        State variables written after the call(s):
        - s.podOrders[id] = beanAmount (contracts/beanstalk/market/MarketplaceFacet/Order.sol#68)
        ReentrancyGuard.s (contracts/beanstalk/ReentrancyGuard.sol#17) can be used in cross function reentrancies:
        - PodTransfer.allowancePods(address,address) (contracts/beanstalk/market/MarketplaceFacet/PodTransfer.sol#41-47)
Reentrancy in Order._createPodOrderV2(uint256,uint256,uint256,bytes) (contracts/beanstalk/market/MarketplaceFacet/Order.sol#74-86):
        External calls:
        - _cancelPodOrderV2(maxPlaceInLine,minFillAmount,pricingFunction,LibTransfer.To.INTERNAL) (contracts/beanstalk/market/MarketplaceFacet/Order.sol#82)
                - returndata = address(token).functionCall(data,SafeERC20: low-level call failed) (node_modules/@openzeppelin/contracts/token/ERC20/SafeERC20.sol#69)
                - LibTransfer.sendToken(C.bean(),amountBeans,msg.sender,mode) (contracts/beanstalk/market/MarketplaceFacet/Order.sol#171)
                - (success,returndata) = target.call{value: value}(data) (node_modules/@openzeppelin/contracts/utils/Address.sol#119)
                - token.safeTransfer(recipient,amount) (contracts/libraries/Token/LibTransfer.sol#82)
        External calls sending eth:
        - _cancelPodOrderV2(maxPlaceInLine,minFillAmount,pricingFunction,LibTransfer.To.INTERNAL) (contracts/beanstalk/market/MarketplaceFacet/Order.sol#82)
                - (success,returndata) = target.call{value: value}(data) (node_modules/@openzeppelin/contracts/utils/Address.sol#119)
        State variables written after the call(s):
        - s.podOrders[id] = beanAmount (contracts/beanstalk/market/MarketplaceFacet/Order.sol#83)
        ReentrancyGuard.s (contracts/beanstalk/ReentrancyGuard.sol#17) can be used in cross function reentrancies:
        - PodTransfer.allowancePods(address,address) (contracts/beanstalk/market/MarketplaceFacet/PodTransfer.sol#41-47)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities
INFO:Detectors:
MockToken._decimals (contracts/mocks/MockToken.sol#18) shadows:
        - ERC20._decimals (node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#44)
Internalizer._balances (contracts/tokens/Fertilizer/Internalizer.sol#37) shadows:
        - ERC1155Upgradeable._balances (node_modules/@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol#27)
Internalizer._uri (contracts/tokens/Fertilizer/Internalizer.sol#39) shadows:
        - ERC1155Upgradeable._uri (node_modules/@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol#33)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#state-variable-shadowing
INFO:Detectors:
FertilizerFacet.addFertilizerOwner(uint128,uint128,uint256) (contracts/beanstalk/barn/FertilizerFacet.sol#61-73) ignores return value by C.usdc().transferFrom(msg.sender,address(this),uint256(amount).mul(1e6)) (contracts/beanstalk/barn/FertilizerFacet.sol#67-71)
MockCurveZap.add_liquidity(address,uint256[4],uint256) (contracts/mocks/curve/MockCurveZap.sol#26-32) ignores return value by IERC20(BEAN).transferFrom(msg.sender,address(this),depAmounts[0]) (contracts/mocks/curve/MockCurveZap.sol#27)
MockCurveZap.add_liquidity(address,uint256[4],uint256) (contracts/mocks/curve/MockCurveZap.sol#26-32) ignores return value by IERC20(USDC).transferFrom(msg.sender,THREE_POOL,depAmounts[2]) (contracts/mocks/curve/MockCurveZap.sol#28)
MockMeta3Curve.exchange(int128,int128,uint256,uint256,address) (contracts/mocks/curve/MockMeta3Curve.sol#171-203) ignores return value by ERC20(coins[i]).transferFrom(msg.sender,address(this),dx) (contracts/mocks/curve/MockMeta3Curve.sol#199)
MockMeta3Curve.exchange(int128,int128,uint256,uint256,address) (contracts/mocks/curve/MockMeta3Curve.sol#171-203) ignores return value by ERC20(coins[j]).transfer(_receiver,dy) (contracts/mocks/curve/MockMeta3Curve.sol#200)
MockMeta3Curve.add_liquidity(uint256[2],uint256,address) (contracts/mocks/curve/MockMeta3Curve.sol#209-264) ignores return value by IBean(coins[i_scope_1]).transferFrom(msg.sender,address(this),amount_scope_2) (contracts/mocks/curve/MockMeta3Curve.sol#256)
MockMeta3Curve.remove_liquidity(uint256,uint256[2],address) (contracts/mocks/curve/MockMeta3Curve.sol#273-293) ignores return value by ERC20(coins[i]).transfer(_receiver,value) (contracts/mocks/curve/MockMeta3Curve.sol#286)
MockMeta3Curve.remove_liquidity_imbalance(uint256[2],uint256,address) (contracts/mocks/curve/MockMeta3Curve.sol#302-351) ignores return value by ERC20(coins[i_scope_1]).transfer(_receiver,amount) (contracts/mocks/curve/MockMeta3Curve.sol#347)
MockMeta3Curve.remove_liquidity_one_coin(uint256,int128,uint256,address) (contracts/mocks/curve/MockMeta3Curve.sol#367-384) ignores return value by IBean(coins[i]).transfer(_receiver,dy) (contracts/mocks/curve/MockMeta3Curve.sol#381)
MockPlainCurve.add_liquidity(uint256[2],uint256) (contracts/mocks/curve/MockPlainCurve.sol#137-193) ignores return value by IBean(coins[i_scope_1]).transferFrom(msg.sender,address(this),amount_scope_2) (contracts/mocks/curve/MockPlainCurve.sol#185)
MockPlainCurve.remove_liquidity_one_coin(uint256,int128,uint256) (contracts/mocks/curve/MockPlainCurve.sol#201-217) ignores return value by IBean(coins[i]).transfer(msg.sender,dy) (contracts/mocks/curve/MockPlainCurve.sol#214)
FertilizerPreMint.mint(uint256) (contracts/tokens/Fertilizer/FertilizerPreMint.sol#42-47) ignores return value by IUSDC.transferFrom(msg.sender,CUSTODIAN,amount) (contracts/tokens/Fertilizer/FertilizerPreMint.sol#46)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unchecked-transfer
INFO:Detectors:
InitBip1.s (contracts/beanstalk/init/InitBip1.sol#17) is never initialized. It is used in:
        - InitBip1.init() (contracts/beanstalk/init/InitBip1.sol#22-25)
InitBip14.s (contracts/beanstalk/init/InitBip14.sol#17) is never initialized. It is used in:
        - InitBip14.init() (contracts/beanstalk/init/InitBip14.sol#22-24)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#uninitialized-state-variables
INFO:Detectors:
LibFunction.useClipboard(bytes,bytes,bytes[]).pasteParams_scope_0 (contracts/libraries/LibFunction.sol#85) is a storage variable never initialized
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#uninitialized-storage-variables
```

We also outputted a [.sarif](https://marketplace.visualstudio.com/items?itemName=MS-SarifVSCode.sarif-viewer) edition:

```
slither . --compile-force-framework hardhat --hardhat-ignore-compile --sarif slither-output.sarif
```

### Appendix 2 - [4naly3er](https://github.com/Picodes/4naly3er) Output

Input:

```
yarn analyze <DIR>/Beanstalk/protocol/contracts
```

You can see the output at `4naly3er_report.md`, we've highlighted the most important parts below:

### Appendix 3 - Coverage

| File                                           | % Stmts    | % Branch   | % Funcs    | % Lines    | Uncovered Lines  |
| ---------------------------------------------- | ---------- | ---------- | ---------- | ---------- | ---------------- |
| contracts/                                     | 79.31      | 100        | 79.31      | 79.31      |                  |
| C.sol                                          | 79.31      | 100        | 79.31      | 79.31      | ... 154,166,174  |
| contracts/beanstalk/                           | 14.29      | 25         | 33.33      | 33.33      |                  |
| AppStorage.sol                                 | 100        | 100        | 100        | 100        |                  |
| AppStorageOld.sol                              | 100        | 100        | 100        | 100        |                  |
| Diamond.sol                                    | 0          | 0          | 0          | 0          | ... 38,41,42,43  |
| ReentrancyGuard.sol                            | 100        | 50         | 100        | 100        |                  |
| contracts/beanstalk/barn/                      | 67.21      | 40.91      | 61.9       | 67.47      |                  |
| FertilizerFacet.sol                            | 100        | 50         | 95.65      | 97.67      | 130              |
| UnripeFacet.sol                                | 35.48      | 38.89      | 21.05      | 35         | ... 204,212,243  |
| contracts/beanstalk/diamond/                   | 66.67      | 100        | 66.67      | 64.86      |                  |
| DiamondCutFacet.sol                            | 100        | 100        | 100        | 100        |                  |
| DiamondLoupeFacet.sol                          | 22.22      | 100        | 20         | 13.33      | ... 55,56,69,70  |
| OwnershipFacet.sol                             | 100        | 100        | 100        | 100        |                  |
| PauseFacet.sol                                 | 100        | 100        | 100        | 100        |                  |
| contracts/beanstalk/farm/                      | 57.14      | 43.85      | 65.38      | 57.6       |                  |
| CurveFacet.sol                                 | 55.3       | 45.28      | 80         | 57.14      | ... 419,423,436  |
| DepotFacet.sol                                 | 100        | 100        | 100        | 100        |                  |
| FarmFacet.sol                                  | 93.75      | 60         | 100        | 91.67      | 104,105          |
| TokenFacet.sol                                 | 28         | 21.43      | 28.57      | 23.08      | ... 362,363,364  |
| TokenSupportFacet.sol                          | 100        | 100        | 100        | 100        |                  |
| contracts/beanstalk/field/                     | 51.85      | 43.33      | 48.15      | 58.23      |                  |
| FieldFacet.sol                                 | 22.58      | 22.22      | 31.58      | 34.04      | ... 353,363,372  |
| FundraiserFacet.sol                            | 91.3       | 75         | 87.5       | 93.75      | 77,185           |
| contracts/beanstalk/init/                      | 15.38      | 0          | 15.38      | 22.14      |                  |
| InitBip0.sol                                   | 100        | 100        | 0          | 0          | 24               |
| InitBip1.sol                                   | 0          | 100        | 0          | 0          | 23,24            |
| InitBip11.sol                                  | 0          | 100        | 0          | 0          | 29,30            |
| InitBip12.sol                                  | 0          | 100        | 0          | 0          | 30,31            |
| InitBip13.sol                                  | 100        | 100        | 0          | 0          | 19               |
| InitBip14.sol                                  | 0          | 100        | 0          | 0          | 23               |
| InitBip16.sol                                  | 0          | 100        | 0          | 0          | 30,31            |
| InitBip2.sol                                   | 100        | 100        | 0          | 0          | 19               |
| InitBip22.sol                                  | 0          | 100        | 0          | 0          | 21               |
| InitBip23.sol                                  | 0          | 100        | 0          | 0          | 21               |
| InitBip24.sol                                  | 0          | 100        | 0          | 0          | 20               |
| InitBip5.sol                                   | 0          | 100        | 0          | 0          | 25,26            |
| InitBip7.sol                                   | 0          | 100        | 0          | 0          | 21               |
| InitBip8.sol                                   | 0          | 100        | 0          | 0          | 27,28,29,30      |
| InitBip9.sol                                   | 0          | 100        | 0          | 0          | 27,28,30         |
| InitBipNewSilo.sol                             | 100        | 100        | 100        | 100        |                  |
| InitBipSunriseImprovements.sol                 | 0          | 100        | 0          | 0          | ... 43,44,45,46  |
| InitDiamond.sol                                | 0          | 0          | 0          | 0          | ... 64,65,67,68  |
| InitEBip6.sol                                  | 100        | 100        | 0          | 0          | 18,19,20         |
| InitEmpty.sol                                  | 100        | 100        | 0          | 100        |                  |
| InitFundraiser.sol                             | 0          | 100        | 0          | 0          | 22               |
| InitHotFix2.sol                                | 0          | 100        | 0          | 0          | ... 56,57,61,62  |
| InitHotFix3.sol                                | 100        | 100        | 0          | 0          | 14               |
| InitHotFix4.sol                                | 100        | 100        | 0          | 100        |                  |
| InitHotFix5.sol                                | 0          | 100        | 0          | 0          | ... 33,35,37,38  |
| InitMint.sol                                   | 0          | 100        | 0          | 0          | 16               |
| InitOmnisciaAudit.sol                          | 100        | 100        | 0          | 100        |                  |
| InitReplant.sol                                | 0          | 100        | 0          | 0          | ... 27,29,31,35  |
| InitSiloEvents.sol                             | 0          | 100        | 0          | 0          | 37,38,39,40      |
| InitSiloToken.sol                              | 0          | 100        | 0          | 0          | 19               |
| InitWhitelist.sol                              | 100        | 100        | 100        | 100        |                  |
| contracts/beanstalk/init/replant/              | 0          | 0          | 0          | 0          |                  |
| Replant1.sol                                   | 0          | 100        | 0          | 0          | ... 134,136,137  |
| Replant3.sol                                   | 0          | 100        | 0          | 0          | ... 111,115,116  |
| Replant4.sol                                   | 0          | 100        | 0          | 0          | ... 61,62,63,65  |
| Replant5.sol                                   | 0          | 100        | 0          | 0          | ... 50,51,53,54  |
| Replant6.sol                                   | 0          | 0          | 0          | 0          | ... 3,94,99,100  |
| Replant7.sol                                   | 0          | 100        | 0          | 0          | ... 85,86,87,88  |
| Replant8.sol                                   | 0          | 0          | 0          | 0          | ... 116,117,118  |
| contracts/beanstalk/market/MarketplaceFacet/   | 100        | 91.35      | 100        | 100        |                  |
| Listing.sol                                    | 100        | 89.58      | 100        | 100        |                  |
| MarketplaceFacet.sol                           | 100        | 81.25      | 100        | 100        |                  |
| Order.sol                                      | 100        | 97.06      | 100        | 100        |                  |
| PodTransfer.sol                                | 100        | 100        | 100        | 100        |                  |
| contracts/beanstalk/metadata/                  | 100        | 50         | 100        | 100        |                  |
| MetadataFacet.sol                              | 100        | 50         | 100        | 100        |                  |
| contracts/beanstalk/silo/                      | 91.18      | 64.81      | 90.32      | 94.78      |                  |
| ApprovalFacet.sol                              | 84.21      | 37.5       | 90         | 85         | 51,52,53         |
| BDVFacet.sol                                   | 69.23      | 50         | 100        | 87.5       | 47               |
| ConvertFacet.sol                               | 100        | 80.77      | 100        | 100        |                  |
| MigrationFacet.sol                             | 84.62      | 100        | 60         | 84.62      | 64,68            |
| WhitelistFacet.sol                             | 100        | 100        | 100        | 100        |                  |
| contracts/beanstalk/silo/SiloFacet/            | 90.99      | 70         | 86.79      | 93.48      |                  |
| LegacyClaimWithdrawalFacet.sol                 | 71.43      | 25         | 75         | 71.43      | 55,56            |
| Silo.sol                                       | 100        | 100        | 100        | 100        |                  |
| SiloExit.sol                                   | 77.78      | 87.5       | 77.27      | 85.71      | ... 314,328,340  |
| SiloFacet.sol                                  | 93.1       | 70         | 90.91      | 94.12      | 277,278          |
| TokenSilo.sol                                  | 100        | 66.67      | 100        | 100        |                  |
| contracts/beanstalk/sun/SeasonFacet/           | 77.45      | 46.15      | 75.86      | 71.52      |                  |
| Oracle.sol                                     | 100        | 100        | 100        | 100        |                  |
| SeasonFacet.sol                                | 84         | 50         | 80         | 92.31      | 91,98            |
| Sun.sol                                        | 50         | 25         | 57.14      | 59.26      | ... 229,231,233  |
| Weather.sol                                    | 87.5       | 50         | 77.78      | 71.62      | ... 268,269,270  |
| contracts/depot/                               | 100        | 100        | 100        | 100        |                  |
| Depot.sol                                      | 100        | 100        | 100        | 100        |                  |
| contracts/ecosystem/price/                     | 0          | 0          | 0          | 0          |                  |
| BeanstalkPrice.sol                             | 0          | 100        | 0          | 0          | ... 22,23,24,26  |
| CurvePrice.sol                                 | 0          | 0          | 0          | 0          | ... ,97,101,102  |
| P.sol                                          | 100        | 100        | 100        | 100        |                  |
| contracts/ecosystem/root/                      | 100        | 100        | 100        | 100        |                  |
| Root.sol                                       | 100        | 100        | 100        | 100        |                  |
| contracts/interfaces/                          | 100        | 100        | 100        | 100        |                  |
| IBean.sol                                      | 100        | 100        | 100        | 100        |                  |
| IBeanstalk.sol                                 | 100        | 100        | 100        | 100        |                  |
| IBeanstalkTransfer.sol                         | 100        | 100        | 100        | 100        |                  |
| IBlockBasefee.sol                              | 100        | 100        | 100        | 100        |                  |
| ICurve.sol                                     | 100        | 100        | 100        | 100        |                  |
| IDelegation.sol                                | 100        | 100        | 100        | 100        |                  |
| IDiamondCut.sol                                | 100        | 100        | 100        | 100        |                  |
| IDiamondLoupe.sol                              | 100        | 100        | 100        | 100        |                  |
| IERC1155Receiver.sol                           | 100        | 100        | 100        | 100        |                  |
| IERC165.sol                                    | 100        | 100        | 100        | 100        |                  |
| IERC4494.sol                                   | 100        | 100        | 100        | 100        |                  |
| IFertilizer.sol                                | 100        | 100        | 100        | 100        |                  |
| ILegacySilo.sol                                | 100        | 100        | 100        | 100        |                  |
| IPipeline.sol                                  | 100        | 100        | 100        | 100        |                  |
| IProxyAdmin.sol                                | 100        | 100        | 100        | 100        |                  |
| IQuoter.sol                                    | 100        | 100        | 100        | 100        |                  |
| ISwapRouter.sol                                | 100        | 100        | 100        | 100        |                  |
| IUSDC.sol                                      | 100        | 100        | 100        | 100        |                  |
| IWETH.sol                                      | 100        | 100        | 100        | 100        |                  |
| contracts/libraries/                           | 62.24      | 38.6       | 78.21      | 62.7       |                  |
| LibAppStorage.sol                              | 100        | 100        | 100        | 100        |                  |
| LibBytes.sol                                   | 76.47      | 33.33      | 83.33      | 76.19      | 35,36,37,39,43   |
| LibBytes64.sol                                 | 80         | 50         | 100        | 100        |                  |
| LibDibbler.sol                                 | 40.26      | 26.67      | 70         | 42.35      | ... 376,377,383  |
| LibFertilizer.sol                              | 98         | 85         | 100        | 97.01      | 128,129          |
| LibFunction.sol                                | 78.57      | 60         | 100        | 85         | 25,26,29         |
| LibIncentive.sol                               | 45.71      | 30.36      | 100        | 46.48      | ... 255,258,266  |
| LibPRBMath.sol                                 | 17.07      | 7.14       | 22.22      | 11.39      | ... 255,261,262  |
| LibPolynomial.sol                              | 100        | 100        | 100        | 100        |                  |
| LibSafeMathSigned128.sol                       | 0          | 0          | 0          | 0          | ... 73,87,88,90  |
| LibSafeMathSigned96.sol                        | 81.25      | 50         | 75         | 81.25      | 87,88,90         |
| LibStrings.sol                                 | 85.71      | 50         | 66.67      | 91.3       | 21,52            |
| LibUnripe.sol                                  | 100        | 100        | 100        | 100        |                  |
| contracts/libraries/Convert/                   | 83.33      | 72.73      | 92.59      | 85.37      |                  |
| LibConvert.sol                                 | 62.07      | 63.33      | 100        | 63.33      | ... 107,108,110  |
| LibConvertData.sol                             | 100        | 100        | 100        | 100        |                  |
| LibCurveConvert.sol                            | 94.44      | 92.86      | 100        | 96.55      | 165              |
| LibLambdaConvert.sol                           | 100        | 100        | 100        | 100        |                  |
| LibMetaCurveConvert.sol                        | 100        | 100        | 100        | 100        |                  |
| LibUnripeConvert.sol                           | 88.89      | 100        | 66.67      | 81.25      | ... 137,141,142  |
| contracts/libraries/Curve/                     | 88.24      | 57.69      | 100        | 95.18      |                  |
| LibBeanMetaCurve.sol                           | 100        | 100        | 100        | 100        |                  |
| LibCurve.sol                                   | 84.62      | 57.69      | 100        | 93.55      | 80,110,111,144   |
| LibMetaCurve.sol                               | 100        | 100        | 100        | 100        |                  |
| contracts/libraries/Oracle/                    | 100        | 91.67      | 100        | 97.83      |                  |
| LibCurveOracle.sol                             | 100        | 91.67      | 100        | 97.83      | 55               |
| contracts/libraries/Silo/                      | 94.23      | 81.82      | 94.44      | 94.5       |                  |
| LibLegacyTokenSilo.sol                         | 89.41      | 69.57      | 88.24      | 89.42      | ... 533,536,537  |
| LibLegacyWhitelist.sol                         | 100        | 100        | 100        | 100        |                  |
| LibSilo.sol                                    | 98.72      | 89.58      | 100        | 95.28      | ... 399,400,401  |
| LibSiloPermit.sol                              | 100        | 91.67      | 100        | 100        |                  |
| LibTokenSilo.sol                               | 89.8       | 80         | 88.24      | 94.29      | 338,339,399,401  |
| LibUnripeSilo.sol                              | 100        | 100        | 100        | 100        |                  |
| LibWhitelist.sol                               | 100        | 100        | 100        | 100        |                  |
| contracts/libraries/Token/                     | 81.69      | 60.53      | 80         | 80         |                  |
| LibApprove.sol                                 | 100        | 100        | 100        | 100        |                  |
| LibBalance.sol                                 | 90.91      | 50         | 80         | 86.67      | 44,47            |
| LibEth.sol                                     | 50         | 25         | 100        | 50         | 21,24            |
| LibTokenApprove.sol                            | 100        | 50         | 100        | 100        |                  |
| LibTokenPermit.sol                             | 100        | 50         | 100        | 100        |                  |
| LibTransfer.sol                                | 88.46      | 77.78      | 100        | 85.19      | 98,99,112,113    |
| LibWeth.sol                                    | 0          | 0          | 0          | 0          | ... 27,28,32,36  |
| contracts/pipeline/                            | 100        | 100        | 100        | 100        |                  |
| Pipeline.sol                                   | 100        | 100        | 100        | 100        |                  |
| contracts/tokens/                              | 100        | 100        | 33.33      | 100        |                  |
| Bean.sol                                       | 100        | 100        | 100        | 100        |                  |
| UnripeBean.sol                                 | 100        | 100        | 0          | 100        |                  |
| UnripeBean3Crv.sol                             | 100        | 100        | 0          | 100        |                  |
| contracts/tokens/ERC20/                        | 86.67      | 100        | 75         | 87.5       |                  |
| BeanstalkERC20.sol                             | 80         | 100        | 66.67      | 80         | 61               |
| ERC20Permit.sol                                | 90         | 100        | 80         | 90.91      | 77               |
| contracts/tokens/Fertilizer/                   | 86.73      | 66.67      | 86.11      | 86.92      |                  |
| Fertilizer.sol                                 | 100        | 83.33      | 100        | 100        |                  |
| Fertilizer1155.sol                             | 71.43      | 41.67      | 85.71      | 72.22      | ... 134,137,139  |
| FertilizerPreMint.sol                          | 100        | 78.57      | 100        | 100        |                  |
| Internalizer.sol                               | 80         | 80         | 55.56      | 80         | 42,46,50,54      |
| ---------------------------------------------- | ---------- | ---------- | ---------- | ---------- | ---------------- |
| All files                                      | 71.96      | 58.23      | 74.48      | 71.78      |                  |
| ---------------------------------------------- | ---------- | ---------- | ---------- | ---------- | ---------------- |
