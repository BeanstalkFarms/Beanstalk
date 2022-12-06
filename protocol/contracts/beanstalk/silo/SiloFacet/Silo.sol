/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./SiloExit.sol";
import "~/libraries/Silo/LibSilo.sol";
import "~/libraries/Silo/LibTokenSilo.sol";

/**
 * @title Silo
 * @author Publius
 */
contract Silo is SiloExit {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event Plant(
        address indexed account,
        uint256 beans
    );

    event ClaimPlenty(
        address indexed account,
        uint256 plenty
    );

    event SeedsBalanceChanged(
        address indexed account,
        int256 delta
    );

    event StalkBalanceChanged(
        address indexed account,
        int256 delta,
        int256 deltaRoots
    );

    //////////////////////// INTERNAL ////////////////////////

    /**
     * @dev Before performing any Silo accounting, we need to account for a user's Grown Stalk.
     * 
     * How updating works: FIXME(doc)
     */
    function _update(address account) internal {
        uint32 _lastUpdate = lastUpdate(account);

        // If already updated this season, there's no Stalk to claim.
        // _lastUpdate > _season() should not be possible, but we check it anyway.
        if (_lastUpdate >= _season()) return;

        // Increment Plenty if a SOP has occured or save Rain Roots if its Raining.
        handleRainAndSops(account, _lastUpdate);

        // Earn Grown Stalk -> The Stalk gained from Seeds.
        earnGrownStalk(account);

        // Bump the lastUpdate season to the current `_season()`.
        s.a[account].lastUpdate = _season();
    }

    function _plant(address account) internal returns (uint256 beans) {
        // Need to update account before we make a Deposit
        _update(account);
        uint256 accountStalk = s.a[account].s.stalk;

        // Calculate balance of Earned Beans.
        beans = _balanceOfEarnedBeans(account, accountStalk);
        if (beans == 0) return 0;
        s.earnedBeans = s.earnedBeans.sub(beans);

        // Deposit Earned Beans
        LibTokenSilo.addDeposit(
            account,
            C.beanAddress(),
            _season(),
            beans,
            beans
        );
        uint256 seeds = beans.mul(C.getSeedsPerBean());

        // Earned Seeds don't auto-compound, so we need to mint new Seeds
        LibSilo.mintSeeds(account, seeds);

        // Earned Stalk auto-compounds and thus is minted alongside Earned Beans
        // Farmers don't receive additional Roots from Earned Stalk.
        uint256 stalk = beans.mul(C.getStalkPerBean());
        s.a[account].s.stalk = accountStalk.add(stalk);

        emit StalkBalanceChanged(account, int256(stalk), 0);
        emit Plant(account, beans);
    }

    function _claimPlenty(address account) internal {
        // Each Plenty is earned in the form of 3Crv.
        uint256 plenty = s.a[account].sop.plenty;
        C.threeCrv().safeTransfer(account, plenty);
        delete s.a[account].sop.plenty;

        emit ClaimPlenty(account, plenty);
    }

    //////////////////////// PRIVATE ////////////////////////

    function earnGrownStalk(address account) private {
        // If this `account` has no Seeds, skip to save gas.
        if (s.a[account].s.seeds == 0) return;
        LibSilo.mintStalk(account, balanceOfGrownStalk(account));
    }

    function handleRainAndSops(address account, uint32 _lastUpdate) private {
        // If no roots, reset Sop counters variables
        if (s.a[account].roots == 0) {
            s.a[account].lastSop = s.season.rainStart;
            s.a[account].lastRain = 0;
            return;
        }
        // If a Sop has occured since last update, calculate rewards and set last Sop.
        if (s.season.lastSopSeason > _lastUpdate) {
            s.a[account].sop.plenty = balanceOfPlenty(account);
            s.a[account].lastSop = s.season.lastSop;
        }
        if (s.season.raining) {
            // If rain started after update, set account variables to track rain.
            if (s.season.rainStart > _lastUpdate) {
                s.a[account].lastRain = s.season.rainStart;
                s.a[account].sop.roots = s.a[account].roots;
            }
            // If there has been a Sop since rain started,
            // save plentyPerRoot in case another SOP happens during rain.
            if (s.season.lastSop == s.season.rainStart)
                s.a[account].sop.plentyPerRoot = s.sops[s.season.lastSop];
        } else if (s.a[account].lastRain > 0) {
            // Reset Last Rain if not raining.
            s.a[account].lastRain = 0;
        }
    }

    //////////////////////// MODIFIERS ////////////////////////

    /**
     * @dev Update the Silo for `msg.sender`.
     */
    modifier updateSilo() {
        _update(msg.sender);
        _;
    }
}
