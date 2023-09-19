/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibAppStorage.sol";
import "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import "contracts/libraries/Silo/LibWhitelist.sol";
import "contracts/libraries/LibSafeMath32.sol";
import "../C.sol";

/**
 * @title LibGauge
 * @author Brean
 * @notice LibGauge handles functionality related to the seed gauge system.
 */
library LibGauge {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    uint256 private constant PRECISION = 1e6;

    /**
     * @notice Emitted when the gaugePoints for an LP silo token changes.
     * @param season The current Season
     * @param token The LP silo token whose gaugePoints was updated.
     * @param gaugePoints The new gaugePoints for the LP silo token.
     */
    event GaugePointChange(
        uint256 indexed season,
        address indexed token,
        uint256 gaugePoints
    );

    /**
     * @notice Updates the seed gauge system.
     * @dev updates the GaugePoints (if applicable) for LP assets
     * and the distribution of grown Stalk to silo assets.
     */
    function stepGauge() internal {
        updateGaugePoints();
        updateGrownStalkEarnedPerSeason();
    }

    /**
     * @notice re-evaluate the gauge points of each LP asset, then normalize.
     * @dev Gauge points are normalized to 100e6.
     */
    function updateGaugePoints() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory whitelistedLPSiloTokens = LibWhitelistedTokens.getSiloLPTokens();
        
        // if there is only one pool, there is no need to update the gauge points.
        if (whitelistedLPSiloTokens.length == 1) return; 
        uint24 totalGaugePoints;
        uint256 totalLPBdv;
        // summate total deposited BDV across all whitelisted LP tokens
        for (uint256 i; i < whitelistedLPSiloTokens.length; ++i) {
            totalLPBdv = totalLPBdv.add(s.siloBalances[whitelistedLPSiloTokens[i]].depositedBdv);
        }
        // if nothing has been deposited, skip gauge point update.
        if (totalLPBdv == 0) return;

        for (uint256 i; i < whitelistedLPSiloTokens.length; ++i) {
            Storage.SiloSettings storage ss = s.ss[whitelistedLPSiloTokens[i]];
            uint256 percentOfDepositedBdv = 
                uint256(s.siloBalances[whitelistedLPSiloTokens[i]].depositedBdv)
                .mul(PRECISION)
                .div(totalLPBdv);
            bytes memory callData = abi.encodeWithSelector(
                ss.GPSelector,
                ss.lpGaugePoints,
                percentOfDepositedBdv
            );
            (bool success, bytes memory data) = address(this).staticcall(callData);
            if (!success) {
                if (data.length == 0) revert();
                assembly {
                    revert(add(32, data), mload(data))
                }
            }
            uint24 newGaugePoints;
            assembly {
                newGaugePoints := mload(add(data, add(0x20, 0)))
            }
            totalGaugePoints += newGaugePoints;
            ss.lpGaugePoints = newGaugePoints;
        }

        // Normalize gauge points
        for (uint256 i; i < whitelistedLPSiloTokens.length; ++i) {
            Storage.SiloSettings storage ss = s.ss[whitelistedLPSiloTokens[i]];
            ss.lpGaugePoints = ss.lpGaugePoints.mul(100e6).div(totalGaugePoints);
            
            emit GaugePointChange(
                s.season.current,
                whitelistedLPSiloTokens[i],
                ss.lpGaugePoints
            );
        }
    }

    /**
     * @notice Updates the average grown stalk per BDV per Season for whitelisted Beanstalk assets.
     * @dev Called at the end of each Season.
     */
    function updateGrownStalkEarnedPerSeason() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 totalBdv;
        address[] memory whitelistedSiloTokens = LibWhitelistedTokens.getSiloTokens(); 
        // TODO: implment the decrement deposited BDV thing for unripe
        for (uint256 i; i < whitelistedSiloTokens.length; ++i) {
            totalBdv = totalBdv.add(s.siloBalances[whitelistedSiloTokens[i]].depositedBdv);
        }

        // if nothing has been deposited, skip grown stalk update.
        if(totalBdv == 0) return;
        uint256 newGrownStalk = uint256(s.seedGauge.averageGrownStalkPerBdvPerSeason).mul(totalBdv).div(PRECISION);
        uint256 newGrownStalkToLP = newGrownStalk.mul(s.seedGauge.percentOfNewGrownStalkToLP).div(PRECISION);

        // update stalkPerBDVPerSeason for bean.
        issueGrownStalkPerBDV(C.BEAN, newGrownStalk.sub(newGrownStalkToLP));

        // update stalkPerBdvPerSeason for LP 
        // reuse whitelistedSiloTokens for gas efficency. 
        whitelistedSiloTokens = LibWhitelistedTokens.getSiloLPTokens();
        // if there is only one pool, then no need to read gauge points.
        if(whitelistedSiloTokens.length == 1) {
            issueGrownStalkPerBDV(whitelistedSiloTokens[0], newGrownStalkToLP);
        } else {
            for(uint256 i = 0; i < whitelistedSiloTokens.length; i++) {
                Storage.SiloSettings storage ss = s.ss[whitelistedSiloTokens[i]];
                issueGrownStalkPerBDV(
                    whitelistedSiloTokens[i], 
                    newGrownStalkToLP.mul(ss.lpGaugePoints).div(100e6)
                );
            }
        }
    }

    /**
     * @notice issues the grown stalk per BDV for the given token.
     * @param token the token to issue the grown stalk for.
     * @param newGrownStalk the amount of grown stalk to issue.
     */
    function issueGrownStalkPerBDV(address token, uint256 newGrownStalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 depositedBdv = s.siloBalances[token].depositedBdv;
        if(depositedBdv > 0){
            LibWhitelist.updateStalkPerBdvPerSeasonForToken(
                token,
                uint24(newGrownStalk.div(depositedBdv))
            );
        }
    }

}