/**
 * SPDX-License-Identifier: MIT
 *
 */

pragma solidity ^0.8.20;

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Call} from "contracts/interfaces/basin/IWell.sol";
import {IPump} from "contracts/interfaces/basin/pumps/IPump.sol";
import {MockToken} from "../MockToken.sol";
import {IWellFunction} from "contracts/interfaces/basin/IWellFunction.sol";

/**
 * @title Mock Well
 */

contract MockSetComponentsWell is MockToken {
    using SafeERC20 for IERC20;

    bytes32 private constant RESERVES_STORAGE_SLOT =
        0x4bba01c388049b5ebd30398b65e8ad45b632802c5faf4964e58085ea8ab03715; // bytes32(uint256(keccak256("reserves.storage.slot")) - 1);
    uint256 constant MAX_UINT128 = 340_282_366_920_938_463_463_374_607_431_768_211_455; // type(uint128).max

    constructor() MockToken("Mock Well", "MWELL") {
        _reserves = new uint256[](2);
    }

    function init() external {
        _reserves = new uint256[](2);
    }

    Call[] public _pumps;
    Call public _wellFunction;

    IERC20[] internal _tokens;

    uint256[] _reserves;

    function well()
        external
        pure
        returns (IERC20[] memory, Call memory, Call[] memory, bytes memory, address)
    {
        return (
            new IERC20[](0),
            Call(address(0), new bytes(0)),
            new Call[](0),
            new bytes(0),
            address(0)
        );
    }

    function pumps() external view returns (Call[] memory) {
        return _pumps;
    }

    function wellFunction() public view returns (Call memory) {
        return _wellFunction;
    }

    function tokens() public view returns (IERC20[] memory) {
        return _tokens;
    }

    function setPumps(Call[] memory __pumps) external {
        delete _pumps;
        for (uint i = 0; i < __pumps.length; i++) {
            _pumps.push(__pumps[i]);
        }
    }

    function setWellFunction(Call memory __wellFunction) external {
        _wellFunction = __wellFunction;
    }

    function setTokens(IERC20[] memory __tokens) external {
        _tokens = __tokens;
    }

    function getReserves() public view returns (uint256[] memory reserves) {
        reserves = _reserves;
    }

    function setReserves(uint256[] memory reserves) public {
        for (uint i; i < _pumps.length; ++i) {
            IPump(_pumps[i].target).update(_reserves, new bytes(0));
        }
        _reserves = reserves;
    }

    /**
     * swapFrom is used to test sop.
     * `swapFrom` is a stripped down version of well.sol swap from.
     * does not update pumps.
     * @dev update if well.sol implementation is updated.
     */
    function swapFrom(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256
    ) external returns (uint256 amountOut) {
        fromToken.safeTransferFrom(msg.sender, address(this), amountIn);
        amountOut = _swapFrom(fromToken, toToken, amountIn, minAmountOut, recipient);
    }

    function _swapFrom(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) internal returns (uint256 amountOut) {
        IERC20[] memory __tokens = tokens();
        (uint256 i, uint256 j) = _getIJ(__tokens, fromToken, toToken);
        uint256[] memory reserves = getReserves();
        uint256 tokenSupply = _calcLpTokenSupply(wellFunction(), reserves);
        reserves[i] += amountIn;

        uint256 reserveJBefore = reserves[j];

        // token supply is calculated here rather then queried as
        // often tests mint/burn tokens without adding or removing liquidity.
        reserves[j] = _calcReserve(wellFunction(), reserves, j, tokenSupply);

        // Note: The rounding approach of the Well function determines whether
        // slippage from imprecision goes to the Well or to the User.
        amountOut = reserveJBefore - reserves[j];
        if (amountOut < minAmountOut) {
            revert("reverted, slippageOut");
        }
        // mint token amount out to recipient
        MockToken(address(toToken)).mint(address(this), amountOut);
        toToken.safeTransfer(recipient, amountOut);
        // emit Swap(fromToken, toToken, amountIn, amountOut, recipient);
        setReserves(reserves);
    }

    /**
     * @dev Returns the indices of `iToken` and `jToken` in `_tokens`.
     * Reverts if either token is not in `_tokens`.
     * Reverts if `iToken` and `jToken` are the same.
     */
    function _getIJ(
        IERC20[] memory __tokens,
        IERC20 iToken,
        IERC20 jToken
    ) internal pure returns (uint256 i, uint256 j) {
        bool foundOne;
        for (uint256 k; k < __tokens.length; ++k) {
            if (iToken == __tokens[k]) {
                i = k;
                if (foundOne) return (i, j);
                foundOne = true;
            } else if (jToken == __tokens[k]) {
                j = k;
                if (foundOne) return (i, j);
                foundOne = true;
            }
        }
        revert("invalid tokens");
    }

    /**
     * @dev Gets the Well's token reserves by reading from byte storage.
     */
    function _getReserves(
        uint256 _numberOfTokens
    ) internal view returns (uint256[] memory reserves) {
        reserves = readUint128(RESERVES_STORAGE_SLOT, _numberOfTokens);
    }

    /**
     * @dev Read `n` packed uint128 reserves at storage position `slot`.
     */
    function readUint128(
        bytes32 slot,
        uint256 n
    ) internal view returns (uint256[] memory reserves) {
        // Initialize array with length `n`, fill it in via assembly
        reserves = new uint256[](n);

        // Shortcut: two reserves can be quickly unpacked from one slot
        if (n == 2) {
            assembly {
                mstore(add(reserves, 32), shr(128, shl(128, sload(slot))))
                mstore(add(reserves, 64), shr(128, sload(slot)))
            }
            return reserves;
        }

        uint256 iByte;
        for (uint256 i = 1; i <= n; ++i) {
            // `iByte` is the byte position for the current slot:
            // i        1 2 3 4 5 6
            // iByte    0 0 1 1 2 2
            iByte = (i - 1) / 2;
            // Equivalent to "i % 2 == 1", but cheaper.
            if (i & 1 == 1) {
                assembly {
                    mstore(
                        // store at index i * 32; i = 0 is skipped by loop
                        add(reserves, mul(i, 32)),
                        shr(128, shl(128, sload(add(slot, iByte))))
                    )
                }
            } else {
                assembly {
                    mstore(add(reserves, mul(i, 32)), shr(128, sload(add(slot, iByte))))
                }
            }
        }
    }

    /**
     * @dev Calculates the `j`th reserve given a list of `reserves` and `lpTokenSupply`
     * using the provided `_wellFunction`. Wraps {IWellFunction.calcReserve}.
     *
     * The Well function is passed as a parameter to minimize gas in instances
     * where it is called multiple times in one transaction.
     */
    function _calcReserve(
        Call memory __wellFunction,
        uint256[] memory reserves,
        uint256 j,
        uint256 lpTokenSupply
    ) internal view returns (uint256 reserve) {
        reserve = IWellFunction(__wellFunction.target).calcReserve(
            reserves,
            j,
            lpTokenSupply,
            __wellFunction.data
        );
    }

    /**
     * @dev Store packed uint128 `reserves` starting at storage position `slot`.
     * Balances are passed as an uint256[], but values must be <= max uint128
     * to allow for packing into a single storage slot.
     */
    function storeUint128(bytes32 slot, uint256[] memory reserves) internal {
        // Shortcut: two reserves can be packed into one slot without a loop
        if (reserves.length == 2) {
            require(reserves[0] <= MAX_UINT128, "ByteStorage: too large");
            require(reserves[1] <= MAX_UINT128, "ByteStorage: too large");
            assembly {
                sstore(slot, add(mload(add(reserves, 32)), shl(128, mload(add(reserves, 64)))))
            }
        } else {
            uint256 maxI = reserves.length / 2; // number of fully-packed slots
            uint256 iByte; // byte offset of the current reserve
            for (uint256 i; i < maxI; ++i) {
                require(reserves[2 * i] <= MAX_UINT128, "ByteStorage: too large");
                require(reserves[2 * i + 1] <= MAX_UINT128, "ByteStorage: too large");
                iByte = i * 64;
                assembly {
                    sstore(
                        add(slot, i),
                        add(
                            mload(add(reserves, add(iByte, 32))),
                            shl(128, mload(add(reserves, add(iByte, 64))))
                        )
                    )
                }
            }
            // If there is an odd number of reserves, create a slot with the last reserve
            // Since `i < maxI` above, the next byte offset `maxI * 64`
            // Equivalent to "reserves.length % 2 == 1", but cheaper.
            if (reserves.length & 1 == 1) {
                require(reserves[reserves.length - 1] <= MAX_UINT128, "ByteStorage: too large");
                iByte = maxI * 64;
                assembly {
                    sstore(
                        add(slot, maxI),
                        add(
                            mload(add(reserves, add(iByte, 32))),
                            shr(128, shl(128, sload(add(slot, maxI))))
                        )
                    )
                }
            }
        }
    }

    /**
     * @dev Calculates the LP token supply given a list of `reserves` using the
     * provided `_wellFunction`. Wraps {IWellFunction.calcLpTokenSupply}.
     *
     * The Well function is passed as a parameter to minimize gas in instances
     * where it is called multiple times in one transaction.
     */
    function _calcLpTokenSupply(
        Call memory __wellFunction,
        uint256[] memory reserves
    ) internal view returns (uint256 lpTokenSupply) {
        lpTokenSupply = IWellFunction(__wellFunction.target).calcLpTokenSupply(
            reserves,
            __wellFunction.data
        );
    }
}
