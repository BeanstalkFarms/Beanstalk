/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibSafeMath128} from "contracts/libraries/LibSafeMath128.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import "contracts/libraries/LibAppStorage.sol";

/**
 * @title Bean Eth Well Oracle Library
 * @notice Contains a function to store and read the BEAN/ETH price in storage.
 * @dev
 * In each `sunrise`/`gm` call, {LibWellMinting} sets the BEAN/ETH price when
 * evalulating the Bean Eth Well during minting and {LibIncentive} reads the
 * BEAN/ETH price when calculating the Sunrise incentive.
 **/
library LibBeanEthWellOracle {
    using SafeCast for uint256;
    using LibSafeMath128 for uint128;

    // The index of the Bean and Weth token addresses in all BEAN/ETH Wells.
    uint256 constant BEAN_INDEX = 0;
    uint256 constant ETH_INDEX = 1;

    /**
     * @dev Sets the BEAN/ETH price in {AppStorage} given a set of reserves.
     * It assumes that the reserves correspond to a BEAN/ETH Constant Product Well
     * given that it computes the price as beanReserve / ethReserve.
     */
    function setBeanEthWellReserves(uint256[] memory reserves) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // If the reserves length is 0, then {LibWellMinting} failed to compute
        // valid manipulation resistant reserves and thus the price is set to 0
        // indicating that the oracle failed to compute a valid price this Season.
        if (reserves.length == 0) {
            s.ethReserve = 0;
            s.beanReserve = 0;
        } else {
            s.ethReserve = reserves[ETH_INDEX].toUint128();
            s.beanReserve = reserves[BEAN_INDEX].toUint128();
        }
    }

    /**
     * @notice Returns the BEAN / ETH price stored in {AppStorage}.
     * The BEAN / ETH price is used twice in sunrise(): Once during {LibEvaluate}
     * and another at {LibIncentive}. After use, {resetBeanEthWellReserves} should be called.
     * @dev this function should only be called during the sunrise function.
     */
    function getBeanEthWellPrice() internal view returns (uint price) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // see {setBeanEthWellReserves} for reasoning.
        // s.ethReserve should be set prior to this function being called.
        if(s.ethReserve == 0) {
            price = 0;
        } else { 
            price = s.beanReserve.mul(1e18).div(s.ethReserve);
        }
    }

    /**
     * @notice fetches the beanEth reserves that are in storage.
     */
    function getBeanEthWellReserves() internal view returns (uint256[] memory twaReserves) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        twaReserves = new uint256[](2);
        twaReserves[BEAN_INDEX] = s.beanReserve;
        twaReserves[ETH_INDEX] = s.ethReserve;
    }

    /**
     * @notice resets s.ethReserve and s.beanReserve to 1. 
     * @dev should be called at the end of sunrise() once the 
     * reserves are not needed anymore to save gas.
     */
    function resetBeanEthWellReserves() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.ethReserve = 1;
        s.beanReserve = 1;
    }
}
