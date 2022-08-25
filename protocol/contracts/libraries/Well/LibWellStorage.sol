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

    enum WellType {
        CONSTANT_PRODUCT
    }

    struct WellInfo {
        address wellId; // Note: wellId is same as token address
        IERC20[] tokens; // list of tokens
        WellType wellType; // well type
        bytes typeData; // Params specific to the well type
    }

    // For gas efficiency reasons, Wells with 2 tokens use a different storage struct.
    // WellState is the state struct for Wells with more than 2 tokens.
    struct WellState {
        uint128[] balances; // well balances of each token
        uint224[] cumulativeBalances; // well balances times time
        uint32 lastTimestamp; // Last timestamp someone interacted with well
    }

    struct CumulativeBalance2 {
        uint224 cumulativeBalance0; // Cumulative balance of token0 in the Well
        uint224 cumulativeBalance1; // Cumulative balance of token1 in the Well
        uint32 timestamp; // Last Timestamp the pool was interacted with
    }

    // Well2State is the state struct for Wells with exactly 2 tokens.
    struct Well2State {
        uint128 balance0; // token balance of token0 in the Well
        uint128 balance1; // token balance of token1 in the Well
        CumulativeBalance2 last; // The cumulative balances at the last update
        CumulativeBalance2 even; // The cumulative balances at the first update after the start of the last even hour.
        CumulativeBalance2 odd; // The cumulative balances at the first update after the start of the last odd hour.
    }

    struct CumulativeBalanceN {
        uint224[] cumulativeBalances; // well balances times time
        uint224 lastCumulativeBalance;
        uint32 timestamp; // Last timestamp someone interacted with well
    }

        // WellState is the state struct for Wells with more than 2 tokens.
    struct WellNState {
        uint128[] balances; // well balances of each token
        CumulativeBalanceN last; // The cumulative balances at the last update
        CumulativeBalanceN even; // The cumulative balances at the first update after the start of the last even hour.
        CumulativeBalanceN odd; // The cumulative balances at the first update after the start of the last odd hour.
    }

    struct TypeInfo {
        bool registered; // Whether the type has been registered or not
        string[] signature; // The typeData signature
    }

    struct WellStorage {
        uint256 numberOfWells; // Total number of wells in Beanstalk
        mapping(WellType => TypeInfo) wt; // Well type info
        mapping(uint256 => address) indices; // Stores a mapping from index to id. Only used in view functions.
        mapping(address => WellInfo) wi; // Stores a mapping from id to well info. Only used in view functions.
        mapping(address => bytes32) wh; // Stores a mapping from id to hash. Only used in view functions.
        mapping(bytes32 => Well2State) w2s; // Stores a mapping from hash to state.
        mapping(bytes32 => WellNState) wNs; // Stores a mapping from hash to state.
    }

    function wellStorage() internal pure returns (WellStorage storage s) {
        bytes32 storagePosition = keccak256("diamond.storage.LibWell");
        assembly {
            s.slot := storagePosition
        }
    }

    function wellNState(WellInfo calldata w)
        internal
        view
        returns (WellNState storage ws)
    {
        ws = wellStorage().wNs[computeWellHash(w)];
    }

    function well2State(WellInfo calldata w)
        internal
        view
        returns (Well2State storage ws)
    {
        ws = wellStorage().w2s[computeWellHash(w)];
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

    function isWell2(IERC20[] calldata tokens) internal pure returns (bool) {
        return tokens.length == 2;
    }
}
