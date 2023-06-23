/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "contracts/libraries/LibAppStorage.sol";

/**
 * @title Bean Eth Well Oracle Library
 * @notice contains a function to store and read the Bean/Eth price in storage
 * @dev
 * Within a `sunrise`/`gm` call:
 * {LibWellMinting} sets the Bean/Eth price when evalulating the Bean Eth Well and
 * {LibIncentive} reads the Bean/Eth price when calculating the Sunrise incentive
 **/
library LibBeanEthWellOracle {
    using SafeMath for uint256;

    // The index of the Bean and Weth token addresses in all Bean/Eth Wells.
    uint256 constant BEAN_INDEX = 0;
    uint256 constant ETH_INDEX = 1;

    /**
     * @dev Sets the Bean/Eth price in {AppStorage} given a set of reserves
     * Assumes that the reserves corresponding to a Bean/Eth Constant Product 2 Well.
     */
    function setBeanEthWellPrice(uint256[] memory reserves) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (reserves.length == 0) {
            s.beanEthPrice = 0;
        } else {
            s.beanEthPrice = reserves[BEAN_INDEX].mul(1e18).div(reserves[ETH_INDEX]);
        }
    }

    /**
     * @dev Returns the BEAN / ETH price stored in {AppStorage} and resets the
     * storage variable to 1 to reduce gas cost. Only {LibIncentive} accesses
     * the Bean/Eth price, so it is safe to assume it will only be read once for
     * each time it is set.
     */
    function getBeanEthWellPrice() internal returns (uint price) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        price = s.beanEthPrice;
        s.beanEthPrice = 1;
    }
}
