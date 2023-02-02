/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Token/LibTransfer.sol";
import "~/libraries/LibIncentive.sol";
import "./Weather.sol";

/**
 * @title SeasonFacet
 * @author Publius, Chaikitty
 * @notice Holds the Sunrise function and handles all logic for Season changes.
 */
contract SeasonFacet is Weather {
    using SafeMath for uint256;

    /**
     * @notice Emitted when the Season changes.
     * @param season The new Season number
     */
    event Sunrise(uint256 indexed season);

    /**
     * @notice Emitted when Beanstalk pays `beans` to `account` as a reward for calling `sunrise()`.
     * @param account The address to which the reward beans were sent
     * @param beans The amount of beans paid as a reward
     */
    event Incentivization(address indexed account, uint256 beans);

    /* The Sunrise reward reaches its maximum after this many blocks elapse. */
    uint256 private constant MAXBLOCKSLATE = 25;

    //////////////////// SUNRISE ////////////////////

    /**
     * @notice Advances Beanstalk to the next Season, sending reward Beans to the caller's circulating balance.
     * @return reward The number of beans minted to the caller.
     */
    function sunrise() external payable returns (uint256) {
        return gm(msg.sender, LibTransfer.To.EXTERNAL);
    }

    /**
     * @notice Advances Beanstalk to the next Season, sending reward Beans to a specified address & balance.
     * @param account Indicates to which address reward Beans should be sent
     * @param mode Indicates whether the reward beans are sent to internal or circulating balance
     * @return reward The number of Beans minted to the caller.
     */
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

    //////////////////// SEASON GETTERS ////////////////////

    /**
     * @notice Returns the current Season number.
     */
    function season() public view returns (uint32) {
        return s.season.current;
    }

    /**
     * @notice Returns whether Beanstalk is Paused. When Paused, the `sunrise()` function cannot be called.
     */
    function paused() public view returns (bool) {
        return s.paused;
    }

    /**
     * @notice Returns the Season struct. See {Storage.Season}.
     */
    function time() external view returns (Storage.Season memory) {
        return s.season;
    }

    /**
     * @notice Returns whether Beanstalk started this Season above or below peg.
     */
    function abovePeg() external view returns (bool) {
        return s.season.abovePeg;
    }

    /**
     * @notice Returns the block during which the current Season started.
     */
    function sunriseBlock() external view returns (uint32){
        return s.season.sunriseBlock;
    }

    /**
     * @notice Returns the expected Season number given the current block timestamp.
     * {sunrise} can be called when `seasonTime() > season()`.
     */
    function seasonTime() public view virtual returns (uint32) {
        if (block.timestamp < s.season.start) return 0;
        if (s.season.period == 0) return type(uint32).max;
        return uint32((block.timestamp - s.season.start) / s.season.period); // Note: SafeMath is redundant here.
    }

    //////////////////// SEASON INTERNAL ////////////////////

    /**
     * @dev Moves the Season forward by 1.
     */
    function stepSeason() private {
        s.season.timestamp = block.timestamp;
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        emit Sunrise(season());
    }

    /**
     * @param account The address to which the reward beans are sent, may or may not
     * be the same as the caller of `sunrise()`
     * @param initialGasLeft The amount of gas left at the start of the transaction
     * @param balances The current balances of the BEAN:3CRV pool returned by {stepOracle}
     * @param mode Send reward beans to Internal or Circulating balance
     * @dev Mints Beans to `account` as a reward for calling {sunrise()}.
     */
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
