// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev String operations.
 */
library LibStrings {

    bytes16 private constant _SYMBOLS = "0123456789abcdef";
    uint8 private constant _ADDRESS_LENGTH = 20;

    /**
     * @dev Converts a `uint256` to its ASCII `string` representation.
     */
    function toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT licence
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        uint256 index = digits - 1;
        temp = value;
        while (temp != 0) {
            buffer[index--] = bytes1(uint8(48 + temp % 10));
            temp /= 10;
        }
        return string(buffer);
    }

     function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }

    function toHexString(address addr) internal pure returns (string memory) {
        return toHexString(uint256(uint160(addr)), _ADDRESS_LENGTH);
    }

    /**
     * @dev Converts a `int256` to its ASCII `string` representation.
     */
    function toString(int256 value) internal pure returns(string memory){
        if(value > 0){
            return toString(uint256(value));
        } else {
            return string(abi.encodePacked("-", toString(uint256(-value))));
        }
    }

    /**
    * @notice returns a substring of a string starting from startIndex and ending at endIndex
    * @param str - the string to extract from
    * @param startIndex - the index to start at
    * @param endIndex - the index to end at
    * insired from: // https://ethereum.stackexchange.com/questions/31457/substring-in-solidity
    */
    function substring(
        string memory str,
        uint startIndex,
        uint endIndex
    ) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);
        for (uint i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }
        return string(result);
    }

    /**
        * @notice returns a string representation of the bpfRemaining with 2 decimal places
        * @param bpfRemaining - the beans per fertilizer remaining
        * note in tests, if the second decimal is a 0, it will not show up
        * used in fertilizer metadata
     */
    function formatBpfRemaining(uint128 bpfRemaining)
        internal 
        pure
        returns (string memory)
    {                                       
                            // cast to uint256 to be compatible with toString  
        string memory bpfString = toString(uint256(bpfRemaining));

        // if the bpfRemaining is 0 just return '0'
        if (bpfRemaining > 0) {
            // add a . after the first index and keep the first 2 decimals
            bpfString = string(
                abi.encodePacked(substring(bpfString, 0, 1), ".", substring(bpfString, 1, 3))
            );
        }
        return bpfString;
    }
}
