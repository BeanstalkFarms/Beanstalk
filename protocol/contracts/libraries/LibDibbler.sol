/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../C.sol";
import "../interfaces/IBean.sol";
import "./LibAppStorage.sol";
import "./LibSafeMath32.sol";

/**
 * @author Publius
 * @title Dibbler
 **/

/**
* @title Dibbler
* @author Publius
* @notice LibDibbler is a field-specific Library that handles
* sowing logic and the amount of pods issued at a given season.
*/
library LibDibbler {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    /**
     * @notice Emitted from {LibDibbler.sowNoSoil} when an `account` creates a plot. 
     * A "plot" is a set of pods created in a single sow() or fund() call. 
     * A plot has two traits - the amount of pods, and the index (place in Line)
     * Plots are created from sowing beans, or from funding a fundraiser. 
     *
     * @param account The account that sowed beans for pods.
     * @param index The place of line of the created plot.
     * @param beans The amount of beans burnt to create the plot.
     * @param pods The amount of pods assocated with the created plot.
     */
    event Sow(
        address indexed account,
        uint256 index,
        uint256 beans,
        uint256 pods
    );

    //////////////////////// SOW ////////////////////////

    /** 
     * @notice sowing that uses soil.
     * @param amount beans to be sown.
     * @param account address to be given pods.
     * @return pods amount of pods issued to the farmer.

     * @dev we seperate {sow} and {sowNoSoil} as the fundraiserFacet issues pods without soil.
     */
    function sow(uint256 amount, address account) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // We can assume amount <= soil from getSowAmount
        s.f.soil = s.f.soil - amount;
        return sowNoSoil(amount, account);
    }

    /** 
     * @notice internal sowing logic that calculates the 
     * amount of pods to issue, updates s.f.pods, and
     * updates the lastSowTime.
     * @param amount beans to be sown.
     * @param account address to be given pods.
     * @return pods amount of pods issued to the farmer.
     */
    function sowNoSoil(uint256 amount, address account)
        internal
        returns (uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 pods = beansToPods(amount, s.w.yield);
        sowPlot(account, amount, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();
        return pods;
    }

    /** 
     * @notice creates a plot for the given pods.
     * and assigns the owner to `account`
     * @param account owner of the pods
     * @param beans the amount of beans burned to create the plot.
     * @param pods amount of pods issued to the farmer.
     */
    function sowPlot(
        address account,
        uint256 beans,
        uint256 pods
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].field.plots[s.f.pods] = pods;
        emit Sow(account, s.f.pods, beans, pods);
    }

    /** 
     * @notice calculates the pods issued given the beans and weather.
     * @param beans the amount of beans the farmer is willing to loan to beanstalk.
     * @param temperature the interest rate beanstalk is willing to issue pods.
     * @param pods amount of pods issued to the farmer.
     *
     * @dev currently the temperature is static within a season, but a future BIP will 
     * make it dynamic.
     */
    function beansToPods(uint256 beans, uint256 temperature)
        private
        pure
        returns (uint256)
    {
        return beans.add(beans.mul(temperature).div(100));
    }

    /** 
     * @notice stores the time in which a sown occured.
     *
     * @dev we ultilize the time in which soil was sown to gauge
     * demand for soil, as a factor of how the temperature should change.
     * for example, if all the soil was sown in 1 second vs 1 hour, 
     * we believe that the former shows more demand than the latter.
     *
     * nextSowTime is a variable representing the time target for 
     * the next season to be considered increasing in deamnd.

     * @dev if there is 1 or more soil available, 
     * or nextSowTime is less than the max, do nothing.
     * else, we assign the nextSowTime to be the difference 
     * between the season timestamp and the current timestamp.
     * nextSowTime is therefore only updated when: 
     * - a sow would use all but 1 soil.
     * - a farmer does the first sow of the season,
     *   as nextSowTime is reinitialized to uint32.max() 
     *   at the start of the season.
     */
    function saveSowTime() private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.f.soil > 1e6 || s.w.nextSowTime < type(uint32).max) return;
        s.w.nextSowTime = uint32(block.timestamp.sub(s.season.timestamp));
    }
}
