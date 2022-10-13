/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @author Publius
 * @title Lib Oracle
 **/
library LibOracle {
    using SafeMath for uint256;

    struct Oracle {
        address oracle;
        bytes4 selector;
        uint8 precision;
        bool flip;
    }

    struct OracleStorage {
        mapping(bytes32 => Oracle) oracles; // Stores a mapping from hash to state.
    }

    function oracleStorage() internal pure returns (OracleStorage storage s) {
        bytes32 storagePosition = keccak256("diamond.storage.Oracle");
        assembly {
            s.slot := storagePosition
        }
    }

    function getOracle(address tokenI, address tokenJ)
        internal
        view
        returns (Oracle storage os)
    {
        os = oracleStorage().oracles[getPriceIndex(tokenI, tokenJ)];
    }

    function getPrice(address tokenI, address tokenJ)
        internal
        view
        returns (uint256 p)
    {
        Oracle storage os = getOracle(tokenI, tokenJ);
        (bool success, bytes memory data) = address(os.oracle).staticcall(
            abi.encodeWithSelector(os.selector)
        );
        p = handlePriceResult(os, success, data);
    }

    function price(address tokenI, address tokenJ)
        internal
        returns (uint256 p)
    {
        Oracle storage os = getOracle(tokenI, tokenJ);
        (bool success, bytes memory data) = address(os.oracle).call(
            abi.encodeWithSelector(os.selector)
        );
        p = handlePriceResult(os, success, data);
    }

    function handlePriceResult(Oracle storage os, bool success, bytes memory data) internal view returns (uint256 p) {
        if (!success) {
            if (data.length == 0) revert();
            assembly {
                revert(add(32, data), mload(data))
            }
        }
        assembly {
            p := mload(add(data, add(0x20, 0)))
        }
        p.mul(10**(36 - os.precision)).div(1e18);
        if (os.flip) p = uint256(1e36).div(p);
    }

    function registerOracle(
        address tokenI,
        address tokenJ,
        address oracle,
        bytes4 selector,
        uint8 precision,
        bool flip,
        bool registerInverse
    ) internal {
        _registerOracle(tokenI, tokenJ, oracle, selector, precision, flip);
        if (registerInverse) _registerOracle(tokenJ, tokenI, oracle, selector, precision, !flip);
    }

    function _registerOracle(
        address tokenI,
        address tokenJ,
        address oracle,
        bytes4 selector,
        uint8 precision,
        bool flip
    ) internal {
        Oracle storage os = getOracle(tokenI, tokenJ);
        os.oracle = oracle;
        os.selector = selector;
        os.precision = precision;
        os.flip = flip;
    }

    function getPriceIndex(address tokenI, address tokenJ)
        internal
        pure
        returns (bytes32 index)
    {
        assembly {
            index := add(shl(96, tokenI), tokenJ)
        }
    }
}
