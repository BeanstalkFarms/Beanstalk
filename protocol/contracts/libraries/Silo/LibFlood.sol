/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {Account} from "contracts/beanstalk/storage/Account.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibAppStorage, AppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";

/**
 * @author Brean
 * @title LibFlood handles logic relating to flooding.
 **/

library LibFlood {
    using LibRedundantMath256 for uint256;
    // @notice This controls the percentage of Bean supply that is flooded to the field.
    // 1000 represents 1/1000, or 0.1% of total Bean supply.
    uint256 internal constant FLOOD_PODLINE_PERCENT_DENOMINATOR = 1000;

    /**
     * @notice Emitted when Beans are minted to a Well during the Season of Plenty.
     * @param season The Season in which Beans were minted for distribution.
     * @param well The Well that the SOP occurred in.
     * @param token The token that was swapped for Beans.
     * @param amount The amount of tokens which was received for swapping Beans.
     */
    event SeasonOfPlentyWell(uint256 indexed season, address well, address token, uint256 amount);

    /**
     * @notice Emitted when Beans are minted to the Field during the Season of Plenty.
     * @param toField The amount of Beans which were distributed to remaining Pods in the Field.
     */
    event SeasonOfPlentyField(uint256 toField);

    // @dev In-memory struct used to store current deltaB, and then reduction amount per-well.
    struct WellDeltaB {
        address well;
        int256 deltaB;
    }

    /**
     * @dev Oversaturated was previously referred to as Raining and thus code
     * references mentioning Rain really refer to Oversaturation. If P > 1 and the
     * Pod Rate is less than 5%, the Farm is Oversaturated. If it is Oversaturated
     * for a Season, each Season in which it continues to be Oversaturated, it Floods.
     */
    function handleRain(uint256 caseId) external {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // cases % 36  3-8 represent the case where the pod rate is less than 5% and P > 1.
        if (caseId.mod(36) < 3 || caseId.mod(36) > 8) {
            if (s.sys.season.raining) {
                s.sys.season.raining = false;
            }
            return;
        } else if (!s.sys.season.raining) {
            s.sys.season.raining = true;
            address[] memory wells = LibWhitelistedTokens.getCurrentlySoppableWellLpTokens();
            // Set the plenty per root equal to previous rain start.
            uint32 season = s.sys.season.current;
            uint32 rainstartSeason = s.sys.season.rainStart;
            for (uint i; i < wells.length; i++) {
                s.sys.sop.sops[season][wells[i]] = s.sys.sop.sops[rainstartSeason][wells[i]];
            }
            s.sys.season.rainStart = s.sys.season.current;
            s.sys.rain.pods = s.sys.fields[s.sys.activeField].pods;
            s.sys.rain.roots = s.sys.silo.roots;
        } else {
            // flood podline first, because it checks current Bean supply
            floodPodline();

            if (s.sys.rain.roots > 0) {
                (
                    WellDeltaB[] memory wellDeltaBs,
                    uint256 totalPositiveDeltaB,
                    uint256 totalNegativeDeltaB,
                    uint256 positiveDeltaBCount
                ) = getWellsByDeltaB();
                wellDeltaBs = calculateSopPerWell(
                    wellDeltaBs,
                    totalPositiveDeltaB,
                    totalNegativeDeltaB,
                    positiveDeltaBCount
                );

                for (uint i; i < wellDeltaBs.length; i++) {
                    sopWell(wellDeltaBs[i]);
                }
            }
        }
    }

    /**
     * @dev internal logic to handle when beanstalk is raining.
     */
    function handleRainAndSops(address account, uint32 lastUpdate) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // If no roots, reset Sop counters variables
        if (s.accts[account].roots == 0) {
            s.accts[account].lastSop = s.sys.season.rainStart;
            s.accts[account].lastRain = 0;
            return;
        }
        // If a Sop has occured since last update, calculate rewards and set last Sop.
        if (s.sys.season.lastSopSeason > lastUpdate) {
            address[] memory tokens = LibWhitelistedTokens.getWhitelistedWellLpTokens();
            for (uint i; i < tokens.length; i++) {
                s.accts[account].sop.perWellPlenty[tokens[i]].plenty = balanceOfPlenty(
                    account,
                    tokens[i]
                );
            }
            s.accts[account].lastSop = s.sys.season.lastSop;
        }
        if (s.sys.season.raining) {
            // If rain started after update, set account variables to track rain.
            if (s.sys.season.rainStart > lastUpdate) {
                s.accts[account].lastRain = s.sys.season.rainStart;
                s.accts[account].sop.rainRoots = s.accts[account].roots;
            }
            // If there has been a Sop since rain started,
            // save plentyPerRoot in case another SOP happens during rain.
            if (s.sys.season.lastSop == s.sys.season.rainStart) {
                address[] memory tokens = LibWhitelistedTokens.getWhitelistedWellLpTokens();
                for (uint i; i < tokens.length; i++) {
                    s.accts[account].sop.perWellPlenty[tokens[i]].plentyPerRoot = s.sys.sop.sops[
                        s.sys.season.lastSop
                    ][tokens[i]];
                }
            }
        } else if (s.accts[account].lastRain > 0) {
            // Reset Last Rain if not raining.
            s.accts[account].lastRain = 0;
        }
    }

    /**
     * @dev returns the amount of `plenty` an account has.
     */
    function balanceOfPlenty(address account, address well) internal view returns (uint256 plenty) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Account storage a = s.accts[account];
        plenty = a.sop.perWellPlenty[well].plenty;
        uint256 previousPPR;

        // If lastRain > 0, then check if SOP occured during the rain period.
        if (s.accts[account].lastRain > 0) {
            // if the last processed SOP = the lastRain processed season,
            // then we use the stored roots to get the delta.
            if (a.lastSop == a.lastRain) {
                previousPPR = a.sop.perWellPlenty[well].plentyPerRoot;
            } else {
                previousPPR = s.sys.sop.sops[a.lastSop][well];
            }
            uint256 lastRainPPR = s.sys.sop.sops[s.accts[account].lastRain][well];

            // If there has been a SOP duing the rain sesssion since last update, process SOP.
            if (lastRainPPR > previousPPR) {
                uint256 plentyPerRoot = lastRainPPR - previousPPR;
                previousPPR = lastRainPPR;
                plenty = plenty.add(
                    plentyPerRoot.mul(s.accts[account].sop.rainRoots).div(C.SOP_PRECISION)
                );
            }
        } else {
            // If it was not raining, just use the PPR at previous SOP.
            previousPPR = s.sys.sop.sops[s.accts[account].lastSop][well];
        }

        // Handle and SOPs that started + ended before after last Silo update.
        if (s.sys.season.lastSop > s.accts[account].lastUpdate) {
            uint256 plentyPerRoot = s.sys.sop.sops[s.sys.season.lastSop][well].sub(previousPPR);
            plenty = plenty.add(plentyPerRoot.mul(s.accts[account].roots).div(C.SOP_PRECISION));
        }
    }

    /**
     * @notice Floods the field, up to 0.1% of the total Bean supply worth of pods.
     */
    function floodPodline() private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // Make 0.1% of the total bean supply worth of pods harvestable.

        uint256 totalBeanSupply = C.bean().totalSupply();
        uint256 sopFieldBeans = totalBeanSupply.div(FLOOD_PODLINE_PERCENT_DENOMINATOR); // 1/1000 = 0.1% of total supply

        // Note there may be cases where zero harvestable pods are available. For clarity, the code will still emit an event
        // but with zero sop field beans.
        uint256 maxHarvestable = s.sys.fields[s.sys.activeField].pods.sub(
            s.sys.fields[s.sys.activeField].harvestable
        );

        sopFieldBeans = sopFieldBeans > maxHarvestable ? maxHarvestable : sopFieldBeans;

        s.sys.fields[s.sys.activeField].harvestable = s
            .sys
            .fields[s.sys.activeField]
            .harvestable
            .add(sopFieldBeans);
        C.bean().mint(address(this), sopFieldBeans);

        emit SeasonOfPlentyField(sopFieldBeans);
    }

    function getWellsByDeltaB()
        internal
        view
        returns (
            WellDeltaB[] memory wellDeltaBs,
            uint256 totalPositiveDeltaB,
            uint256 totalNegativeDeltaB,
            uint256 positiveDeltaBCount
        )
    {
        address[] memory wells = LibWhitelistedTokens.getCurrentlySoppableWellLpTokens();
        wellDeltaBs = new WellDeltaB[](wells.length);

        for (uint i = 0; i < wells.length; i++) {
            wellDeltaBs[i] = WellDeltaB(wells[i], LibDeltaB.currentDeltaB(wells[i]));
            if (wellDeltaBs[i].deltaB > 0) {
                totalPositiveDeltaB += uint256(wellDeltaBs[i].deltaB);
                positiveDeltaBCount++;
            } else {
                totalNegativeDeltaB += uint256(-wellDeltaBs[i].deltaB);
            }
        }

        // Sort the wellDeltaBs array
        quickSort(wellDeltaBs, 0, int(wellDeltaBs.length - 1));
    }

    // Reviewer note: This works, but there's got to be a way to make this more gas efficient
    function quickSort(
        WellDeltaB[] memory arr,
        int left,
        int right
    ) internal pure returns (WellDeltaB[] memory) {
        if (left >= right) return arr;

        // Choose the median of left, right, and middle as pivot (improves performance on random data)
        uint mid = uint(left) + (uint(right) - uint(left)) / 2;
        WellDeltaB memory pivot = arr[uint(left)].deltaB > arr[uint(mid)].deltaB
            ? (
                arr[uint(left)].deltaB < arr[uint(right)].deltaB
                    ? arr[uint(left)]
                    : arr[uint(right)]
            )
            : (arr[uint(mid)].deltaB < arr[uint(right)].deltaB ? arr[uint(mid)] : arr[uint(right)]);

        int i = left;
        int j = right;
        while (i <= j) {
            while (arr[uint(i)].deltaB > pivot.deltaB) i++;
            while (pivot.deltaB > arr[uint(j)].deltaB) j--;
            if (i <= j) {
                (arr[uint(i)], arr[uint(j)]) = (arr[uint(j)], arr[uint(i)]);
                i++;
                j--;
            }
        }

        if (left < j) {
            return quickSort(arr, left, j);
        }
        if (i < right) {
            return quickSort(arr, i, right);
        }
        return arr;
    }

    /**
     * @dev Flood was previously called a "Season of Plenty" (SOP for short).
     * When Beanstalk has been Oversaturated for a Season, Beanstalk returns the
     * Bean price to its peg by minting additional Beans and selling them directly
     * on the sop well. Proceeds from the sale in the form of WETH are distributed to
     * Stalkholders at the beginning of a Season in proportion to their Stalk
     * ownership when the Farm became Oversaturated. Also, at the beginning of the
     * Flood, all Pods that were minted before the Farm became Oversaturated Ripen
     * and become Harvestable.
     * For more information On Oversaturation see {Weather.handleRain}.
     */
    function sopWell(WellDeltaB memory wellDeltaB) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (wellDeltaB.deltaB > 0) {
            IERC20 sopToken = LibWell.getNonBeanTokenFromWell(wellDeltaB.well);

            uint256 sopBeans = uint256(wellDeltaB.deltaB);
            C.bean().mint(address(this), sopBeans);

            // Approve and Swap Beans for the non-bean token of the SOP well.
            C.bean().approve(wellDeltaB.well, sopBeans);
            uint256 amountOut = IWell(wellDeltaB.well).swapFrom(
                C.bean(),
                sopToken,
                sopBeans,
                0,
                address(this),
                type(uint256).max
            );
            rewardSop(wellDeltaB.well, amountOut, address(sopToken));
            emit SeasonOfPlentyWell(
                s.sys.season.current,
                wellDeltaB.well,
                address(sopToken),
                amountOut
            );
        }
    }

    /**
     * @dev Allocate `sop token` during a Season of Plenty.
     */
    function rewardSop(address well, uint256 amount, address sopToken) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.sop.sops[s.sys.season.rainStart][well] = s
        .sys
        .sop
        .sops[s.sys.season.lastSop][well].add(amount.mul(C.SOP_PRECISION).div(s.sys.rain.roots));

        s.sys.season.lastSop = s.sys.season.rainStart;
        s.sys.season.lastSopSeason = s.sys.season.current;

        // update Beanstalk's stored overall plenty for this well
        s.sys.sop.plentyPerSopToken[sopToken] += amount;
    }

    /*
     * @notice Calculates the amount of beans per well that should be minted in a sop.
     * @param wellDeltaBs The deltaBs of all whitelisted wells in which to flood. Must be sorted in descending order.
     */
    function calculateSopPerWell(
        WellDeltaB[] memory wellDeltaBs,
        uint256 totalPositiveDeltaB,
        uint256 totalNegativeDeltaB,
        uint256 positiveDeltaBCount
    ) internal pure returns (WellDeltaB[] memory) {
        // most likely case is that all deltaBs are positive
        if (positiveDeltaBCount == wellDeltaBs.length) {
            // if all deltaBs are positive, need to sop all to zero, so return existing deltaBs
            return wellDeltaBs;
        }

        if (totalPositiveDeltaB < totalNegativeDeltaB || positiveDeltaBCount == 0) {
            // The less than conditional can occur if the twaDeltaB is positive, but the instanteous deltaB is negative or 0
            // In that case, no reductions are needed.
            // If there are no positive values, no well flooding is needed, return zeros
            for (uint256 i = 0; i < positiveDeltaBCount; i++) {
                wellDeltaBs[i].deltaB = 0;
            }
            return wellDeltaBs;
        }

        if (totalPositiveDeltaB < totalNegativeDeltaB) {
            for (uint256 i = 0; i < positiveDeltaBCount; i++) {
                wellDeltaBs[i].deltaB = 0;
            }
            return wellDeltaBs;
        }

        uint256 shaveToLevel = totalNegativeDeltaB / positiveDeltaBCount;

        // Loop through positive deltaB wells starting at the highest, re-use the deltaB value slot
        // as reduction amount (amount of beans to flood per well).
        for (uint256 i = positiveDeltaBCount; i > 0; i--) {
            if (shaveToLevel > uint256(wellDeltaBs[i - 1].deltaB)) {
                shaveToLevel += (shaveToLevel - uint256(wellDeltaBs[i - 1].deltaB)) / (i - 1);
                // amount to sop for this well must be zero
                wellDeltaBs[i - 1].deltaB = 0;
            } else {
                wellDeltaBs[i - 1].deltaB = wellDeltaBs[i - 1].deltaB - int256(shaveToLevel);
            }
        }
        return wellDeltaBs;
    }
}
