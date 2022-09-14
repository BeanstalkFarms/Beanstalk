/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Type/LibWellType.sol";

/**
 * @author Publius
 * @title Lib Well Storage defines the Well Storage and corresponding structs.
 **/
library LibWellStorage {

    event Swap(
        address wellId,
        IERC20 fromToken,
        IERC20 toToken,
        uint256 fromAmount,
        uint256 toAmount
    );

    event AddLiquidity(address wellId, uint256[] amounts);
    event RemoveLiquidity(address wellId, uint256[] amounts);
    event RemoveLiquidityOneToken(address wellId, IERC20 token, uint256 amount);

    struct WellInfo {
        address wellId; // Note: wellId is same as token address
        IERC20[] tokens; // list of tokens
        LibWellType.WellType wellType; // well type
        bytes typeData; // Params specific to the well type
    }

    /**
     * Balance is a generic struct for modifying and accessing cumulative balances
    **/
    struct Balances {
        // Current balances
        uint128[] balances;

        // Exponential Moving Average balances usable for instantaneous oracles
        uint128[] emaBalances;
    
        // cumulative balances usable for time period oracles
        uint224[] cumulativeBalances;

        // Timestamp the Balance was last updated
        uint32 timestamp;
    }

    /**
     * B2 is a struct intended for 2 balances in a storage-efficient fashion.
    **/
    struct B2 {
        // Current balances 
        uint128 balance0;
        uint128 balance1;

        // Exponential Moving Average balances usable for instantaneous oracles
        uint128 emaBalance0;
        uint128 emaBalance1;
    
        // cumulative balances usable for time period oracles
        uint224 cumulativeBalance0;
        uint224 cumulativeBalance1;

        // Timestamp the Balance was last updated
        uint32 timestamp;
    }

    /**
     * BN is a struct intended for N balances in a storage-efficient fashion.
    **/
    struct BN {
        // Current balances 
        uint128[8] balances; // array of stored balances
        
        // Exponential Moving Average balances usable for instantaneous oracles
        uint128[8] emaBalances;
    
        // cumulative balances usable for time period oracles
        uint224[8] cumulativeBalances; // array of cumulative balances
        uint224 lastCumulativeBalance; // cumulative value of the last balance. Stored separately from the array for gas efficiency

        // Timestamp the Balance was last updated
        uint32 timestamp; // Last Timestamp the balances were modified
    }

    struct WellStorage {
        uint256 numberOfWells; // Total number of wells in Beanstalk
        mapping(LibWellType.WellType => bool) registered; // Well type info
        mapping(uint256 => address) indices; // Stores a mapping from index to id. Only used in view functions.
        mapping(address => WellInfo) wi; // Stores a mapping from id to well info. Only used in view functions.
        mapping(address => bytes32) wh; // Stores a mapping from id to hash. Only used in view functions.
        mapping(bytes32 => B2) w2s; // Stores a mapping from hash to 2 token well state.
        mapping(bytes32 => BN) wNs; // Stores a mapping from hash to state.
    }

    function wellStorage() internal pure returns (WellStorage storage s) {
        bytes32 storagePosition = keccak256("diamond.storage.LibWell");
        assembly {
            s.slot := storagePosition
        }
    }

    function wellInfo(address wellId) internal view returns (WellInfo storage wi) {
        wi = wellStorage().wi[wellId];
    }

    function wellNState(WellInfo calldata w)
        internal
        view
        returns (BN storage ws)
    {
        ws = wellStorage().wNs[computeWellHash(w)];
    }

    function well2State(WellInfo calldata w)
        internal
        view
        returns (B2 storage ws)
    {
        ws = wellStorage().w2s[computeWellHash(w)];
    }

    function wellHash(address wellId)
        internal
        view
        returns (bytes32 wellHash)
    {
        wellHash = LibWellStorage.wellStorage().wh[wellId];
    }

    // Well storage is indexed by the hash of the WellInfo struct.
    function computeWellHash(LibWellStorage.WellInfo memory w)
        internal
        pure
        returns (bytes32 wellHash)
    {
        wellHash = keccak256(
            abi.encodePacked(w.wellId, w.tokens, w.wellType, w.typeData)
        );
    }

    function getN(address wellId)
        internal 
        view 
        returns (uint256 n)
    {
        n = wellInfo(wellId).tokens.length;
    }
}
