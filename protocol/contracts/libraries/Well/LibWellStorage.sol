/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @author Publius
 * @title Lib Well Storage
 **/
library LibWellStorage {

    enum WellType {
        CONSTANT_PRODUCT
    }

    struct WellInfo {
        address wellId; // Note: wellId is same as token address
        IERC20[] tokens; // list of tokens
        WellType wellType; // well type
        bytes typeData; // Params specific to the well type
    }

    // Well2State is the state struct for Wells with exactly 2 tokens.
    struct Well2State {
        uint128 balance0; // token balance of token0 in the Well
        uint128 balance1; // token balance of token1 in the Well
        uint32 lastTimestamp; // Last Timestamp the pool was interacted with
        uint256 cumulativeBalance0; // Cumulative balance of token0 in the Well
        uint256 cumulativeBalance1; // Cumulative balance of token1 in the Well
    }

    // WellState is the state struct for Wells with more than 2 tokens.
    struct WellState {
        uint128[] balances; // well balances of each token
        uint256[] cumulativeBalances; // well balances times time
        uint32 lastTimestamp; // Last timestamp someone interacted with well
    }

    struct TypeInfo {
        bool registered;
        string[] signature;
    }

    struct WellStorage {
        uint256 numberOfWells; // Total number of wells in Beanstalk
        mapping(WellType => TypeInfo) wt; // Well type info
        mapping(uint256 => address) indices; // Stores a mapping from index to id. Only used in view functions.
        mapping(address => WellInfo) wi; // Stores a mapping from id to well info. Only used in view functions.
        mapping(address => bytes32) wh; // Stores a mapping from id to hash. Only used in view functions.
        mapping(bytes32 => Well2State) w2s; // Stores a mapping from hash to state.
        mapping(bytes32 => WellState) ws; // Stores a mapping from hash to state.
    }

    function wellStorage() internal pure returns (WellStorage storage s) {
        bytes32 storagePosition = keccak256("diamond.storage.LibWell");
        assembly {
            s.slot := storagePosition
        }
    }

    function wellState(WellInfo calldata w)
        internal
        view
        returns (WellState storage ws)
    {
        ws = wellStorage().ws[computeWellHash(w)];
    }

    function computeWellHash(LibWellStorage.WellInfo memory w)
        internal
        pure
        returns (bytes32 wellHash)
    {
        wellHash = keccak256(
            abi.encodePacked(w.wellId, w.tokens, w.wellType, w.typeData)
        );
    }
}
