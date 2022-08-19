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
        mapping(uint256 => address) indices; // Stores a mapping from index to id. Only used in view functions.
        mapping(address => WellInfo) pi; // Stores a mapping from id to well info. Only used in view functions.
        mapping(address => bytes32) ph; // Stores a mapping from id to hash. Only used in view functions.
        mapping(bytes32 => WellState) ps; // Stores a mapping from hash to state.
        mapping(WellType => TypeInfo) wt;
    }

    function wellStorage() internal pure returns (WellStorage storage s) {
        bytes32 storagePosition = keccak256("diamond.storage.LibWell");
        assembly {
            s.slot := storagePosition
        }
    }

    function wellState(WellInfo calldata p)
        internal
        view
        returns (WellState storage ps)
    {
        ps = wellStorage().ps[computeWellHash(p)];
    }

    function computeWellHash(LibWellStorage.WellInfo memory p)
        internal
        pure
        returns (bytes32 wellHash)
    {
        wellHash = keccak256(
            abi.encodePacked(p.wellId, p.tokens, p.wellType, p.typeData)
        );
    }
}
