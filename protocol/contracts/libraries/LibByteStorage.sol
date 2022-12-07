/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title LibByteStorage provides an interface for storying bytes.
 **/
library LibByteStorage {

    function storeUint128(bytes32 slot, uint128[] memory balances) internal {
        if (balances.length == 2) {
            bytes32 balanceBytes;
            assembly {
                balanceBytes := shl(128, mload(add(balances, 32)))
            }
            assembly {
                balanceBytes := mload(add(balances, 64))
            }
            bytes16 temp;
            assembly {
                temp := mload(add(balances, 64))
                sstore(
                    slot,
                    add(
                        shl(128, mload(add(balances, 32))),
                        shr(128, shl(128, mload(add(balances, 64))))
                    )
                )
            }
        } else {
            uint256 maxI = balances.length / 2;
            uint256 iByte;
            for (uint256 i = 0; i < maxI; i++) {
                iByte = i * 64;
                assembly {
                    sstore(
                        add(slot, i),
                        add(
                            shl(128, mload(add(balances, add(iByte, 32)))),
                            shr(
                                128,
                                shl(128, mload(add(balances, add(iByte, 64))))
                            )
                        )
                    )
                }
            }
            if (balances.length % 2 == 1) {
                iByte = maxI * 64;
                assembly {
                    sstore(
                        add(slot, maxI),
                        add(
                            shl(128, mload(add(balances, add(iByte, 32)))),
                            shr(128, shl(128, sload(add(slot, maxI))))
                        )
                    )
                }
            }
        }
    }

    function readUint128(bytes32 slot, uint256 n) internal view returns (uint128[] memory balances) {
        balances = new uint128[](n);
        if (n == 2) {
            assembly {
                mstore(add(balances, 32), shr(128, sload(slot)))
                mstore(add(balances, 64), sload(slot))
            }
            return balances;
        }
        uint256 iByte;
        for (uint256 i = 1; i <= n; i++) {
            iByte = (i-1)/2;
            if (i % 2 == 1) {
                assembly { mstore(add(balances, mul(i,32)), shr(128, sload(add(slot,iByte)))) }
            } else {
                assembly { mstore(add(balances, mul(i,32)), sload(add(slot,iByte))) }
            }
        }
    }

    function readUint128IntoUint256(bytes32 slot, uint256 n) internal view returns (uint256[] memory balances) {
        balances = new uint256[](n);
        if (n == 2) {
            assembly {
                mstore(add(balances, 32), shr(128, sload(slot)))
                mstore(add(balances, 64), shr(128, shl(128, sload(slot))))
            }
            return balances;
        }
        uint256 iByte;
        for (uint256 i = 1; i <= n; i++) {
            iByte = (i-1)/2;
            if (i % 2 == 1) {
                assembly { mstore(add(balances, mul(i,32)), shr(128, sload(add(slot,iByte)))) }
            } else {
                assembly { mstore(add(balances, mul(i,32)), sload(add(slot,iByte))) }
            }
        }
    }

    function readUint256(bytes32 slot, uint256 n) internal view returns (uint256[] memory balances) {
        balances = new uint256[](n);
        uint256 iMax = n*32;
        for (uint256 i = 0; i < iMax; i += 32) {
            assembly { mstore(add(add(balances, 32), i), sload(add(slot, i))) }
        }
    }

    function storeUint256(bytes32 slot, uint256[] memory data) internal {
        uint256 iMax = data.length * 32;
        for (uint i = 0; i < iMax; i += 32) {
            assembly { sstore(add(slot, i), mload(add(add(data,32), i))) }
        }
    }
}
