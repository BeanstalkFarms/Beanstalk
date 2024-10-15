// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Weather} from "./Weather.sol";
import {LibIncentive} from "contracts/libraries/LibIncentive.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {IBean} from "contracts/interfaces/IBean.sol";

/**
 * @title SeasonFacet
 * @author Publius, Chaikitty, Brean
 * @notice Holds the Sunrise function and handles all logic for Season changes.
 */
contract SeasonFacet is Invariable, Weather {
    using LibRedundantMath256 for uint256;

    /**
     * @notice Emitted when the Season changes.
     * @param season The new Season number
     */
    event Sunrise(uint256 indexed season);

    //////////////////// SUNRISE ////////////////////

    /**
     * @notice Advances Beanstalk to the next Season, sending reward Beans to the caller's circulating balance.
     * @return reward The number of beans minted to the caller.
     * @dev No out flow because any externally sent reward beans are freshly minted.
     */
    function sunrise() external payable fundsSafu nonReentrant noOutFlow returns (uint256) {
        return _gm(LibTractor._user(), LibTransfer.To.EXTERNAL);
    }

    /**
     * @notice Advances Beanstalk to the next Season, sending reward Beans to a specified address & balance.
     * @param account Indicates to which address reward Beans should be sent
     * @param mode Indicates whether the reward beans are sent to internal or circulating balance
     * @return reward The number of Beans minted to the caller.
     * @dev No out flow because any externally sent reward beans are freshly minted.
     */
    function gm(
        address account,
        LibTransfer.To mode
    ) public payable fundsSafu noOutFlow nonReentrant returns (uint256) {
        return _gm(account, mode);
    }

    function _gm(address account, LibTransfer.To mode) private returns (uint256) {
        require(!s.sys.paused, "Season: Paused.");
        require(seasonTime() > s.sys.season.current, "Season: Still current Season.");
        checkSeasonTime();
        uint32 season = stepSeason();
        int256 deltaB = stepOracle();
        LibGerminate.endTotalGermination(season, LibWhitelistedTokens.getWhitelistedTokens());
        uint256 caseId = calcCaseIdandUpdate(deltaB);
        LibGauge.stepGauge();
        stepSun(deltaB, caseId);

        return incentivize(account, mode);
    }

    /**
     * @notice checks that 1) Beanstalk is unpaused and
     * 2) at least 1 period has passed since the last Season change.
     * @dev in the case where more than 1 period has passed,
     * s.sys.season.start is updated to reflect the time skipped,
     * such that multiple sunrises cannot be called in one transaction.
     */
    function checkSeasonTime() internal {
        require(!s.sys.paused, "Season: Paused.");
        uint32 _seasonTime = seasonTime();
        uint32 currentSeason = s.sys.season.current;
        require(_seasonTime > currentSeason, "Season: Still current Season.");
        if (_seasonTime > currentSeason + 1) {
            s.sys.season.start += s.sys.season.period.mul(_seasonTime - currentSeason - 1);
        }
    }

    /**
     * @notice Returns the expected Season number given the current block timestamp.
     * {sunrise} can be called when `seasonTime() > s.sys.season.current`.
     */
    function seasonTime() public view virtual returns (uint32) {
        if (block.timestamp < s.sys.season.start) return 0;
        if (s.sys.season.period == 0) return type(uint32).max;
        return uint32((block.timestamp - s.sys.season.start) / s.sys.season.period);
    }

    //////////////////// SEASON INTERNAL ////////////////////

    /**
     * @dev Moves the Season forward by 1.
     */
    function stepSeason() private returns (uint32 season) {
        s.sys.season.current += 1;
        season = s.sys.season.current;
        s.sys.season.sunriseBlock = uint64(block.number); // Note: will overflow after 2^64 blocks.
        emit Sunrise(season);
    }

    /**
     * @param account The address to which the reward beans are sent, may or may not
     * be the same as the caller of `sunrise()`
     * @param mode Send reward beans to Internal or Circulating balance
     * @dev Mints Beans to `account` as a reward for calling {sunrise()}.
     */
    function incentivize(address account, LibTransfer.To mode) private returns (uint256) {
        uint256 secondsLate = block.timestamp.sub(
            s.sys.season.start.add(s.sys.season.period.mul(s.sys.season.current))
        );

        // reset USD Token prices and TWA reserves in storage for all whitelisted Well LP Tokens.
        address[] memory whitelistedWells = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint256 i; i < whitelistedWells.length; i++) {
            LibWell.resetUsdTokenPriceForWell(whitelistedWells[i]);
            LibWell.resetTwaReservesForWell(whitelistedWells[i]);
        }

        uint256 incentiveAmount = LibIncentive.determineReward(secondsLate);

        LibTransfer.mintToken(IBean(s.sys.tokens.bean), incentiveAmount, account, mode);

        emit LibIncentive.Incentivization(account, incentiveAmount);
        return incentiveAmount;
    }
}
