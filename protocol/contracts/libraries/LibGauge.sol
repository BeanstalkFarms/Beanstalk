/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibAppStorage.sol";
import "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import "contracts/libraries/Silo/LibWhitelist.sol";
import "../C.sol";

/**
 * @title LibGauge
 * @author Brean
 * @notice LibGauge handles functionality related to the seed Gauge system.
 */
library LibGauge {
    using SafeMath for uint256;

    uint256 private constant PRECISION = 1e6;

    
    /**
     * @notice Updates the seed gauge system.
     */
    function stepGauge() internal {
        updateGaugePoints();
        updateGrownStalkEarnedPerSeason();
    }
    /**
     * @notice Updates the average grown stalk per BDV per Season for whitelisted Beanstalk assets.
     * @dev Called at the end of each Season.
     */
    function updateGrownStalkEarnedPerSeason() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 newGrownStalk = uint256(s.seedGauge.averageGrownStalkPerBdvPerSeason).mul(s.seedGauge.totalBdv);
        uint256 newGrownStalkToLP = newGrownStalk.mul(s.seedGauge.percentOfNewGrownStalkToLP).div(PRECISION);

        // update stalkPerBDVPerSeason for bean
        issueGrownStalkPerBDV(C.BEAN, newGrownStalk - newGrownStalkToLP);

        // update stalkPerBdvPerSeason for LP 
        address[] memory whitelistedLPSiloTokens = LibWhitelistedTokens.getSiloLPTokens();
        // if there is only one pool, then no need to read gauge points.
        if(whitelistedLPSiloTokens.length == 1) {
            issueGrownStalkPerBDV(whitelistedLPSiloTokens[0], newGrownStalkToLP);
        } else {
            for(uint256 i = 0; i < whitelistedLPSiloTokens.length; i++) {
                Storage.SiloSettings storage ss = s.ss[whitelistedLPSiloTokens[i]];
                issueGrownStalkPerBDV(
                    whitelistedLPSiloTokens[i], 
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
        uint256 totalBdv;
        // summate total deposited BDV across all whitelisted LP tokens
        for (uint256 i; i < whitelistedLPSiloTokens.length; ++i) {
            totalBdv = totalBdv.add(s.siloBalances[whitelistedLPSiloTokens[i]].depositedBdv);
        }
        
        for (uint256 i; i < whitelistedLPSiloTokens.length; ++i) {
            Storage.SiloSettings storage ss = s.ss[whitelistedLPSiloTokens[i]];
            uint256 percentOfDepositedBdv = 
                uint256(s.siloBalances[whitelistedLPSiloTokens[i]].depositedBdv)
                .mul(PRECISION)
                .div(s.seedGauge.totalBdv);
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
            ss.lpGaugePoints = uint24(uint32(ss.lpGaugePoints) * 100e6 / totalGaugePoints);
        }
    }
}
