/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/OracleFacet.sol";

/**
 * @author Publius
 * @title Mock Oracle Facet
**/
contract MockOracleFacet is OracleFacet {

    function captureE() public virtual returns (Decimal.D256 memory, Decimal.D256 memory) {
        if (s.o.initialized) {
            return updateOracle();
        } else {
            initializeOracle();
            return (Decimal.one(), Decimal.one());
        }
    }

    function timestamp() public view returns (uint32) {
        return s.o.timestamp;
    }

}
