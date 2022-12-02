/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../beanstalk/AppStorage.sol";

/**
 * @author Publius
 * @title Sample is a sample shell of a Facet.
**/
contract SampleFacet {

    AppStorage private s;

    function sample() public view returns (uint256 sample) {
        sample = 1;
    }
}
