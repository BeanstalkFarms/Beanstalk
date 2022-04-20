/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Sun.sol";
import "../../../interfaces/IOracle.sol";
import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibIncentive.sol";

/**
 * @author Publius
 * @title Season holds the sunrise function and handles all logic for Season changes.
**/
contract SeasonFacet is Sun {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    event Sunrise(uint256 indexed season);
    event Incentivization(address indexed account, uint256 beans);
    event SeasonSnapshot(
        uint32 indexed season,
        int256 deltaB,
        uint256 supply,
        uint256 stalk,
        uint256 seeds,
        uint256 podIndex,
        uint256 harvestableIndex
    );

    /**
     * Sunrise
    **/

    function sunrise() external {
        require(!paused(), "Season: Paused.");
        require(seasonTime() > season(), "Season: Still current Season.");

        int256 deltaB = IOracle(address(this)).capture();
        
        stepGovernance();
        stepSeason();
        decrementWithdrawSeasons();
        snapshotSeason(deltaB);
        stepWeather(deltaB, s.f.soil);
        uint256 increase = stepSun(deltaB);
        stepSilo(increase);
        incentivize(msg.sender, C.getAdvanceIncentive());

        LibCheck.balanceCheck();

        emit Sunrise(season());
    }

    function stepSeason() private {
        s.season.current += 1;
    }
    
    function decrementWithdrawSeasons() internal {
        uint withdrawSeasons = s.season.withdrawSeasons;
        if ((withdrawSeasons > 13 && s.season.current % 84 == 0) ||
            (withdrawSeasons > 5 && s.season.current % 168 == 0)) {
                s.season.withdrawSeasons -= 1;
        }
    }

    function snapshotSeason(int256 deltaB) private {
        s.season.timestamp = block.timestamp;
        emit SeasonSnapshot(
            s.season.current,
            deltaB,
            bean().totalSupply(),
            s.s.stalk,
            s.s.seeds,
            s.f.pods,
            s.f.harvestable
        );
    }

    function incentivize(address account, uint256 amount) private {
        uint256 incentive = LibIncentive.fracExp(amount, 100, incentiveTime(), 1);
        mintToAccount(account, incentive);
        emit Incentivization(account, incentive);
    }
}
