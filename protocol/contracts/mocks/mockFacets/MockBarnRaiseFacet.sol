/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/BarnRaiseFacet.sol";

/**
 * @author Publius
 * @title Mock Sprout Facet
**/

contract MockBarnRaiseFacet is BarnRaiseFacet {
    function setBarnRaiseE(bool barnRaising, uint256 brOwedBeans) external {
        s.season.barnRaising = barnRaising;
        s.brOwedBeans = brOwedBeans;
    }

    function setBarnRaisePaidE(uint256 brPaidBeans) external {
        s.brPaidBeans = brPaidBeans;
    }

    function setBRTokens(uint256 _brTokens) external {
        s.brTokens = _brTokens;
    }
}