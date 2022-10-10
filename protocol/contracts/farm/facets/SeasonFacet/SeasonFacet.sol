/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Weather.sol";
import "../../../libraries/LibIncentive.sol";
import "../../../libraries/Token/LibTransfer.sol";

/**
 * @author Publius
 * @title Season Facet
 * @notice holds the Sunrise function and handles all logic for Season changes.
 **/
contract SeasonFacet is Weather {
    using SafeMath for uint256;

    event Sunrise(uint256 indexed season);
    event Incentivization(address indexed account, uint256 beans);

    // Im using this for generic logging of integer values. will remove when finished testing
    event GenericUint256(uint256 value, string label);

    /**
     * Sunrise
     **/

    /// @notice advances Beanstalk to the next Season.
    function sunrise(LibTransfer.To mode) external payable returns (uint256) {
        uint256 initialGasLeft = gasleft();
        require(!paused(), "Season: Paused.");
        require(seasonTime() > season(), "Season: Still current Season.");
        stepSeason();
        int256 deltaB = stepOracle();
        uint256 caseId = stepWeather(deltaB);
        stepSun(deltaB, caseId);
        return incentivize(msg.sender, C.getAdvanceIncentive(), initialGasLeft, mode);
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
        emit Sunrise(season());
    }

    function incentivize(
        address account,
        uint256 amount,
        uint256 initialGasLeft,
        LibTransfer.To mode
    ) private returns (uint256) {
        uint256 timestamp = block.timestamp.sub(
            s.season.start.add(s.season.period.mul(season()))
        );

        uint256 ethPrice = C.chainlinkContract().latestAnswer();
        uint256 basefee = C.basefeeContract().block_basefee();
        emit GenericUint256(ethPrice, "latestAnswer");
        emit GenericUint256(basefee, "basefee");

        // emit GenericUint256(s.season.start, "s.season.start");
        // emit GenericUint256(s.season.period, "s.season.period");
        // emit GenericUint256(timestamp, "incentivize.timestamp");
        // emit GenericUint256(gasleft(), "gas left");

        uint256 usedGas = initialGasLeft.sub(gasleft());
        emit GenericUint256(usedGas, "usedGas");

        if (timestamp > 300) timestamp = 300;
        uint256 incentive = LibIncentive.fracExp(amount, 100, timestamp, 1);

        // TODO: mint based on mode
        C.bean().mint(account, incentive);
        emit Incentivization(account, incentive);
        return incentive;
    }
}
