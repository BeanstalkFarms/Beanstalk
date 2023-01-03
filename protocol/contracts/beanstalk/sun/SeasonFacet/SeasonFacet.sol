/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Token/LibTransfer.sol";
import "~/libraries/LibIncentive.sol";
import "./Weather.sol";

/**
 * @author Publius, Chaikitty
 * @title Season Facet
 * @notice holds the Sunrise function and handles all logic for Season changes.
 **/
contract SeasonFacet is Weather {
    using SafeMath for uint256;

    event Sunrise(uint256 indexed season);
    event Incentivization(address indexed account, uint256 beans);

    uint256 private constant MAXBLOCKSLATE = 25;
    /**
     * Sunrise
     **/

    /// @notice advances Beanstalk to the next Season, sending reward beans to the caller's circulating balance
    /// @return reward The number of beans minted for the caller.
    function sunrise() external payable returns (uint256) {
        return gm(msg.sender, LibTransfer.To.EXTERNAL);
    }

    /// @notice advances Beanstalk to the next Season.
    /// @param account Indicates to which address the reward beans should be sent.
    /// @param mode Indicates whether the reward beans are sent to internal or circulating balance.
    /// @return reward The number of beans minted for the caller.
    function gm(
        address account,
        LibTransfer.To mode
    ) public payable returns (uint256) {
        uint256 initialGasLeft = gasleft();
        require(!paused(), "Season: Paused.");
        require(seasonTime() > season(), "Season: Still current Season.");
        stepSeason();
        (int256 deltaB, uint256[2] memory balances) = stepOracle();
        uint256 caseId = stepWeather(deltaB);
        stepSun(deltaB, caseId);
        return incentivize(account, initialGasLeft, balances, mode);
    }

    /**
     * Season Getters
     **/

    function season() public view returns (uint32) {
        return s.season.current;
    }

    function paused() public view returns (bool) {
        return s.paused;
    }

    function time() external view returns (Storage.Season memory) {
        return s.season;
    }

    function abovePeg() external view returns (bool) {
        return s.season.abovePeg;
    }

    function sunriseBlock() external view returns (uint32){
        return s.season.sunriseBlock;
    }

    function seasonTime() public view virtual returns (uint32) {
        if (block.timestamp < s.season.start) return 0;
        if (s.season.period == 0) return type(uint32).max;
        return uint32((block.timestamp - s.season.start) / s.season.period); // Note: SafeMath is redundant here.
    }

    /**
     * Season Internal
     **/

    function stepSeason() private {
        s.season.timestamp = block.timestamp;
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        emit Sunrise(season());
    }

    function incentivize(
        address account,
        uint256 initialGasLeft,
        uint256[2] memory balances,
        LibTransfer.To mode
    ) private returns (uint256) {
        // Number of blocks the sunrise is late by
        uint256 blocksLate = block.timestamp.sub(
            s.season.start.add(s.season.period.mul(season()))
        )
        .div(C.getBlockLengthSeconds());

        // Maximum 300 seconds to reward exponent (25*C.getBlockLengthSeconds())
        if (blocksLate > MAXBLOCKSLATE) {
            blocksLate = MAXBLOCKSLATE;
        }

        uint256 incentiveAmount = LibIncentive.determineReward(initialGasLeft, balances, blocksLate);

        LibTransfer.mintToken(C.bean(), incentiveAmount, account, mode);
        emit Incentivization(account, incentiveAmount);
        return incentiveAmount;
    }
}
