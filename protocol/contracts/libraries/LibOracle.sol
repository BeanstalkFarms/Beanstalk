/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title Lib Oracle
 **/
library LibOracle {

    struct Oracle {
        address oracle;
        bytes4 selector;
        uint8 precision;
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

    function oracle(address tokenI, address tokenJ) internal view returns (Oracle storage os) {
        os = oracleStorage().oracles[getPriceIndex(tokenI, tokenJ)];
    }

    function getPrice(address tokenI, address tokenJ) internal view returns (uint256 price) {
        Oracle storage os = oracle(tokenI, tokenJ);
        (bool success, bytes memory data) = address(os.oracle).staticcall(abi.encodeWithSelector(os.selector));
        if (!success) {
            if (data.length == 0) revert();
            assembly {
                revert(add(32, data), mload(data))
            }
        }
        assembly {
            price := mload(add(data, add(0x20, 0)))
        }
    }

    function registerOracle(address tokenI, address tokenJ, Oracle calldata o) internal {
        Oracle storage os = oracle(tokenI, tokenJ);
        os.oracle = o.oracle;
        os.selector = o.selector;
        os.precision = o.precision;
    }

    function getPriceIndex(address tokenI, address tokenJ) internal pure returns (bytes32 index) {
        assembly {
            index := add(shl(96, tokenI), tokenJ)
        }
    }
}
