// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Account
 * @notice Stores Farmer-level Beanstalk state.
 * @param bean A Farmer's Unripe Bean Deposits only as a result of Replant (previously held the V1 Silo Deposits/Withdrawals for Beans).
 * @param lp A Farmer's Unripe LP Deposits as a result of Replant of BEAN:ETH Uniswap v2 LP Tokens (previously held the V1 Silo Deposits/Withdrawals for BEAN:ETH Uniswap v2 LP Tokens).
 * @param field A Farmer's Field storage.
 * @param silo A Farmer's Silo storage.
 * @param lastUpdate The Season in which the Farmer last updated their Silo.
 * @param lastSop The last Season that a SOP occurred at the time the Farmer last updated their Silo.
 * @param lastRain The last Season that it started Raining at the time the Farmer last updated their Silo.
 * @param roots A Farmer's Root balance.
 * @param legacyV2Deposits DEPRECATED - SiloV2 was retired in favor of Silo V3. A Farmer's Silo Deposits stored as a map from Token address to Season of Deposit to Deposit.
 * @param withdrawals Withdraws were removed in zero withdraw upgrade - A Farmer's Withdrawals from the Silo stored as a map from Token address to Season the Withdrawal becomes Claimable to Withdrawn amount of Tokens.
 * @param sop A Farmer's Season of Plenty storage.
 * @param depositAllowances A mapping of `spender => Silo token address => amount`.
 * @param tokenAllowances Internal balance token allowances.
 * @param depositPermitNonces A Farmer's current deposit permit nonce
 * @param tokenPermitNonces A Farmer's current token permit nonce
 * @param legacyV3Deposits DEPRECATED: Silo V3 deposits. Deprecated in favor of SiloV3.1 mapping from depositId to Deposit.
 * @param mowStatuses A mapping of whitelisted token address to MowStatus.
 * @param isApprovedForAll A mapping of ERC1155 operator to approved status. ERC1155 compatability.
 * @param germinatingStalk A Farmer's germinating stalk. Separated into odd and even stalk.
 * @param deposits SiloV3.1 deposits. A mapping from depositId to Deposit. SiloV3.1 introduces greater precision for deposits.
 * @param unripeClaimed True if a Farmer has Claimed an Unripe Token. A mapping from Farmer to Unripe Token to its Claim status.
 * @param internalTokenBalance A mapping from Token address to Internal Balance. It stores the amount of the Token that the Farmer has stored as an Internal Balance in Beanstalk.
 */
struct Account {
    // Silo v3.1.
    mapping(uint256 => Deposit) deposits; // Silo v3.1 Deposits stored as a map from uint256 to Deposit. This is an concat of the token address and the stem for a ERC20 deposit.
    Field field;
    Silo silo;
    uint32 lastUpdate;
    uint32 lastSop;
    uint32 lastRain;
    SeasonOfPlenty sop;
    uint256 roots;
    mapping(address => mapping(address => uint256)) depositAllowances;
    mapping(address => mapping(IERC20 => uint256)) tokenAllowances;
    uint256 depositPermitNonces;
    uint256 tokenPermitNonces;
    mapping(address => MowStatus) mowStatuses;
    mapping(address => bool) isApprovedForAll;
    // Germination
    GerminatingStalk germinatingStalk;
    mapping(address => bool) unripeClaimed;
    mapping(IERC20 => uint256) internalTokenBalance;
}

/**
 * @notice Stores a Farmer's Plots and Pod allowances.
 * @param plots A Farmer's Plots. Maps from Plot index to Pod amount.
 * @param podAllowances An allowance mapping for Pods similar to that of the ERC-20 standard. Maps from spender address to allowance amount.
 */
struct Field {
    mapping(uint256 => uint256) plots;
    mapping(address => uint256) podAllowances;
}

/**
 * @notice Stores a Farmer's Deposits and Seeds per Deposit.
 * @param deposits Unripe Bean/LP Deposits (previously Bean/LP Deposits).
 * @param depositSeeds BDV of Unripe LP Deposits / 4 (previously # of Seeds in corresponding LP Deposit).
 */
struct AssetSilo {
    mapping(uint32 => uint256) deposits;
    mapping(uint32 => uint256) depositSeeds;
}

/**
 * @notice Represents a Deposit of a given Token in the Silo at a given Season.
 * @param amount The amount of Tokens in the Deposit.
 * @param bdv The Bean-denominated value of the total amount of Tokens in the Deposit.
 * @dev `amount` and `bdv` are packed as uint128 to save gas.
 */
struct Deposit {
    uint128 amount;
    uint128 bdv;
}

/**
 * @notice Stores a Farmer's Stalk and Seeds balances.
 * @param stalk Balance of the Farmer's Stalk.
 * @param seeds DEPRECATED – Balance of the Farmer's Seeds. Seeds are no longer referenced as of Silo V3.
 */
struct Silo {
    uint256 stalk;
    uint256 seeds;
}

/**
 * @notice Stores a Farmer's germinating stalk.
 * @param odd - stalk from assets deposited in odd seasons.
 * @param even - stalk from assets deposited in even seasons.
 */
struct GerminatingStalk {
    uint128 odd;
    uint128 even;
}

/**
 * @notice This struct stores the mow status for each whitelisted token, for each farmer.
 * This gets updated each time a farmer mows, or adds/removes deposits.
 * @param lastStem The last cumulative grown stalk per bdv index at which the farmer mowed.
 * @param bdv The bdv of all of a farmer's deposits of this token type.
 *
 */
struct MowStatus {
    int96 lastStem;
    uint128 bdv;
}

/**
 * @notice Stores a Farmer's Season of Plenty (SOP) balances.
 * @param roots The number of Roots a Farmer had when it started Raining.
 * @param plentyPerRoot The global Plenty Per Root index at the last time a Farmer updated their Silo.
 * @param plenty The balance of a Farmer's plenty. Plenty can be claimed directly for tokens.
 */
struct SeasonOfPlenty {
    uint256 roots;
    uint256 plentyPerRoot;
    uint256 plenty;
}
