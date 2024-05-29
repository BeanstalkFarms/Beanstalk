// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GerminationSide} from "./System.sol";

/**
 * @title Account
 * @notice Stores Farmer-level Beanstalk state.
 * @param roots A Farmer's Root balance.
 * @param stalk Balance of the Farmer's Stalk.
 * @param depositPermitNonces A Farmer's current deposit permit nonce.
 * @param tokenPermitNonces A Farmer's current token permit nonce.
 * @param lastUpdate The Season in which the Farmer last updated their Silo.
 * @param lastSop The last Season that a SOP occurred at the time the Farmer last updated their Silo.
 * @param lastRain The last Season that it started Raining at the time the Farmer last updated their Silo.
 * @param _buffer_0 Reserved storage for future additions.
 * @param deposits SiloV3.1 deposits. A mapping from depositId to Deposit. SiloV3.1 introduces greater precision for deposits.
 * @param depositIdList A list of depositIds for each token owned by the account.
 * @param field A mapping from FieldId to a Farmer's Field storage.
 * @param depositAllowances A mapping of `spender => Silo token address => amount`.
 * @param tokenAllowances Internal balance token allowances.
 * @param mowStatuses A mapping of whitelisted token address to MowStatus.
 * @param isApprovedForAll A mapping of ERC1155 operator to approved status. ERC1155 compatability.
 * @param germinatingStalk A Farmer's germinating stalk. Separated into odd and even stalk.
 * @param internalTokenBalance A mapping from Token address to Internal Balance. It stores the amount of the Token that the Farmer has stored as an Internal Balance in Beanstalk.
 * @param _buffer_1 Reserved storage for future additions.
 * @param silo A Farmer's Silo storage.
 * @param sop A Farmer's Season of Plenty storage.
 */
struct Account {
    uint256 roots;
    uint256 stalk;
    uint256 depositPermitNonces;
    uint256 tokenPermitNonces;
    uint32 lastUpdate;
    uint32 lastSop;
    uint32 lastRain;
    bytes32[16] _buffer_0;
    mapping(uint256 => Deposit) deposits;
    mapping(address => uint256[]) depositIdList;
    mapping(uint256 => Field) fields;
    mapping(address => mapping(address => uint256)) depositAllowances;
    mapping(address => mapping(IERC20 => uint256)) tokenAllowances;
    mapping(address => MowStatus) mowStatuses;
    mapping(address => bool) isApprovedForAll;
    mapping(GerminationSide => uint128) germinatingStalk;
    mapping(IERC20 => uint256) internalTokenBalance;
    bytes32[16] _buffer_1;
    SeasonOfPlenty sop;
}

/**
 * @notice Stores a Farmer's Plots and Pod allowances.
 * @param plots A Farmer's Plots. Maps from Plot index to Pod amount.
 * @param podAllowances An allowance mapping for Pods similar to that of the ERC-20 standard. Maps from spender address to allowance amount.
 * @param plotIndexes An array of Plot indexes. Used to return the farm plots of a Farmer.
 * @param _buffer Reserved storage for future additions.
 */
struct Field {
    mapping(uint256 => uint256) plots;
    mapping(address => uint256) podAllowances;
    uint256[] plotIndexes;
    bytes32[4] _buffer;
}

/**
 * @notice Stores a Farmer's Season of Plenty (SOP) balances.
 * @param roots The number of Roots a Farmer had when it started Raining.
 * @param plentyPerRoot The global Plenty Per Root index at the last time a Farmer updated their Silo.
 * @param plenty The balance of a Farmer's plenty. Plenty can be claimed directly for tokens.
 * @param _buffer Reserved storage for future additions.
 */
struct SeasonOfPlenty {
    uint256 rainRoots; // The number of Roots a Farmer had when it started Raining.
    mapping(address => PerWellPlenty) perWellPlenty; // a mapping from well to plentyPerRoot and plenty.
    bytes32[4] _buffer;
}

/**
 * @notice Stores a Farmer's Season of Plenty (SOP) balances.
 * @param plentyPerRoot The Plenty Per Root index for this well at the last time a Farmer updated their Silo.
 * @param plenty The balance of a Farmer's plenty. Plenty can be claimed directly for the well's non-Bean token.
 */
struct PerWellPlenty {
    uint256 plentyPerRoot;
    uint256 plenty;
    bytes32[4] _buffer;
}

/**
 * @notice Represents a Deposit of a given Token in the Silo at a given Season.
 * @param amount The amount of Tokens in the Deposit.
 * @param bdv The Bean-denominated value of the total amount of Tokens in the Deposit.
 * @param _buffer Reserved storage for future additions.
 * @dev `amount` and `bdv` are packed as uint128 to save gas.
 */
struct Deposit {
    uint128 amount;
    uint128 bdv;
}

/**
 * @notice Stores a Farmer's germinating stalk.
 * @param odd - stalk from assets deposited in odd seasons.
 * @param even - stalk from assets deposited in even seasons.
 * @param _buffer Reserved storage for future additions.
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
 * @param _buffer Reserved storage for future additions.
 */
struct MowStatus {
    int96 lastStem;
    uint128 bdv;
}
