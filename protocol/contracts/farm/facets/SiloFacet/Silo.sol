/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./SiloExit.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";

/**
 * @author Publius
 * @title Silo Entrance
 **/
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

    /**
     * Internal
     **/

    /**
     * Does not modify Silo state.
     **/
    function _updateHelper(address account) private {
        uint32 _lastUpdate = lastUpdate(account);
        if (_lastUpdate >= season()) return;
        // Increment Plenty if a SOP has occured or save Rain Roots if its Raining.
        handleRainAndSops(account, _lastUpdate);
        s.a[account].lastUpdate = season();
    }

    function _update(address account) internal {
        _updateHelper(account);
        // Earn Grown Stalk -> The Stalk gained from Seeds.
        earnGrownStalk(account);
    }

    function _multiUpdate(address[] calldata accounts) internal {
        uint256[] memory stalk = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; ++i) {
            _updateHelper(accounts[i]);
            stalk[i] = balanceOfGrownStalk(accounts[i]);
        }
        // Earn Grown Stalk -> The Stalk gained from Seeds.
        multiEarnGrownStalk(accounts, stalk);
    }

    /**
     * Does not modify Silo state.
     **/
    function _plantHelper(address account, uint256 otherEarnedBeans) private returns (uint256 beans, uint256 seeds) {
        uint256 accountStalk = s.a[account].s.stalk;
        // Calculate balance of Earned Beans.
        beans = _balanceOfEarnedBeans(account, accountStalk, otherEarnedBeans);
        if (beans == 0) return (0, 0);
        // Deposit Earned Beans
        LibTokenSilo.addDeposit(
            account,
            C.beanAddress(),
            season(),
            beans,
            beans
        );
        seeds = beans.mul(C.getSeedsPerBean());

        // Earned Stalk auto-compounds and thus is minted alongside Earned Beans
        // Farmers don't receive additional Roots from Earned Stalk.
        uint256 stalk = beans.mul(C.getStalkPerBean());
        s.a[account].s.stalk = accountStalk.add(stalk);

        emit StalkBalanceChanged(account, int256(stalk), 0);
        emit Plant(account, beans);
    }

    function _plant(address account) internal returns (uint256 beans) {
        // Need to update account before we make a Deposit
        _update(account); // SILO STATE CHANGE x2

        uint256 seeds;
        (beans, seeds) = _plantHelper(account, 0);
        s.earnedBeans = s.earnedBeans.sub(beans); // SYSTEM STATE CHANGE x1

        // Earned Seeds don't auto-compound, so we need to mint new Seeds
        LibSilo.incrementBalanceOfSeeds(account, seeds); // SILO STATE CHANGE x1
    }
    
    function _multiPlant(address[] calldata accounts) internal returns (uint256 beansSum) {
        // Need to update accounts before we make a Deposit
        _multiUpdate(accounts); // SILO STATE CHANGE x2 (s.s.stalk, s.s.roots)

        beansSum = 0; // SOLIDITY(funder): Does this need to be inited? What is actually most gas efficient?
        uint256 seeds;
        uint256 beans;
        uint256[] memory accountsSeeds = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; ++i) {
            (beans, seeds) = _plantHelper(accounts[i], beansSum);
            beansSum += beans;
            accountsSeeds[i] = seeds;
        }
        s.earnedBeans = s.earnedBeans.sub(beansSum); // SYSTEM STATE CHANGE x1 (s.earnedBeans)

        // Earned Seeds don't auto-compound, so we need to mint new Seeds
        LibSilo.multiIncrementBalanceOfSeeds(accounts, accountsSeeds); // SILO STATE CHANGE x1 (s.s.seeds)s
    }

    function _claimPlenty(address account) internal {
        // Each Plenty is earned in the form of 3Crv.
        uint256 plenty = s.a[account].sop.plenty;
        C.threeCrv().safeTransfer(account, plenty);
        delete s.a[account].sop.plenty;

        emit ClaimPlenty(account, plenty);
    }

    function earnGrownStalk(address account) private {
        // If they have no seeds, we can save gas.
        if (s.a[account].s.seeds == 0) return;
        LibSilo.incrementBalanceOfStalk(account, balanceOfGrownStalk(account));
    }

    function multiEarnGrownStalk(address[] calldata accounts, uint256[] memory stalk) private {
        LibSilo.multiIncrementBalanceOfStalk(accounts, stalk);
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

    modifier updateSilo() {
        _update(msg.sender);
        _;
    }
}
