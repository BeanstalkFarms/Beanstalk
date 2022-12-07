/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
        bytes wellFunction;
        IERC20[] tokens; // list of tokens
        bytes decimalData;
        bytes[] pumps;
    }

    struct WellStorage {
        uint256 numberOfWells; // Total number of wells in Beanstalk
        mapping(uint256 => address) indices; // Stores a mapping from index to id. Only used in view functions.
        mapping(address => WellInfo) wi; // Stores a mapping from id to well info. Only used in view functions.
        mapping(address => bytes32) wh; // Stores a mapping from id to hash. Only used in view functions.
    }

    function wellStorage() internal pure returns (WellStorage storage s) {
        bytes32 storagePosition = keccak256("diamond.storage.Well");
        assembly {
            s.slot := storagePosition
        }
    }

    function wellInfo(address wellId) internal view returns (WellInfo storage wi) {
        wi = wellStorage().wi[wellId];
    }

    function wellDecimalData(address wellId) internal view returns (bytes storage wd) {
        wd = wellInfo(wellId).decimalData;
    }

    function getWellHash(address wellId)
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
            abi.encodePacked(w.wellId, w.wellFunction, w.tokens, w.decimalData, abi.encode(w.pumps))
        );
    }
}
