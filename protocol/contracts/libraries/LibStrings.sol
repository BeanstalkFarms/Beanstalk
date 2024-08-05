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
    * @notice Returns a substring of a string starting from startIndex and ending at endIndex.
    * @param str - The string to extract from.
    * @param startIndex - The index to start at.
    * @param endIndex - The index to end at.
    * Inspired by: https://ethereum.stackexchange.com/questions/31457/substring-in-solidity
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
     * @notice Formats a uint128 number with 6 decimals to a string with 2 decimals.
     * @param number - The number to format.
     * @return string - The formatted string.
     */
    function formatUintWith6DecimalsTo2(uint128 number)
        internal 
        pure
        returns (string memory)
    {                                       
        // Cast to uint256 to be compatible with toString  
        string memory numString = toString(uint256(number));

        // If the number has fewer than 6 decimals, add trailing zeros
        while (bytes(numString).length < 7) {
            numString = string(abi.encodePacked("0", numString));
        }

        // Extract the integer part and the first 2 decimal places
        string memory integerPart = substring(numString, 0, bytes(numString).length - 6);
        string memory decimalPart = substring(numString, bytes(numString).length - 6, bytes(numString).length - 4);

        // Concatenate the integer part and the decimal part with a dot in between
        return string(abi.encodePacked(integerPart, ".", decimalPart));
    }
}
