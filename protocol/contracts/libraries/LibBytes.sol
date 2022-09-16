// SPDX-License-Identifier: Unlicense
/*
 * @title Solidity Bytes Arrays Utils
 * @author Gonçalo Sá <goncalo.sa@consensys.net>
 *
 * @dev Bytes tightly packed arrays utility library for ethereum contracts written in Solidity.
 *      The library lets you concatenate, slice and type cast bytes arrays both in memory and storage.
 * Note: Only sections of the original code that have been utilized in LibPolynomial are kept in this library.
 */
 pragma solidity =0.7.6;


 library LibBytes {
     function toUint8(bytes memory _bytes, uint256 _start) internal pure returns (uint8) {
         require(_start + 1 >= _start, "toUint8_overflow");
         require(_bytes.length >= _start + 1 , "toUint8_outOfBounds");
         uint8 tempUint;
 
         assembly {
             tempUint := mload(add(add(_bytes, 0x1), _start))
         }
 
         return tempUint;
     }
 
     function toUint256(bytes memory _bytes, uint256 _start) internal pure returns (uint256) {
         require(_start + 32 >= _start, "toUint256_overflow");
         require(_bytes.length >= _start + 32, "toUint256_outOfBounds");
         uint256 tempUint;
 
         assembly {
             tempUint := mload(add(add(_bytes, 0x20), _start))
         }
 
         return tempUint;
     }
 }