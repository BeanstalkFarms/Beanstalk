/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../beanstalk/silo/SiloFacet/SiloFacet.sol";
import "../../libraries/Silo/LibWhitelist.sol";
import "../../libraries/Silo/LibLegacyTokenSilo.sol";

/**
 * @author Publius
 * @title Mock Silo Facet
**/

contract MockSiloFacet is SiloFacet {

    uint256 constant private AMOUNT_TO_BDV_BEAN_ETH = 119894802186829;
    uint256 constant private AMOUNT_TO_BDV_BEAN_3CRV = 992035;
    uint256 constant private AMOUNT_TO_BDV_BEAN_LUSD = 983108;

    using SafeMath for uint256;
    using SafeMath for uint128;

    function mockWhitelistToken(address token, bytes4 selector, uint32 stalk, uint32 stalkEarnedPerSeason) external {
       whitelistTokenLegacy(token, selector, stalk, stalkEarnedPerSeason);
    }

    function mockBDV(uint256 amount) external pure returns (uint256) {
        return amount;
    }

    function mockBDVIncrease(uint256 amount) external pure returns (uint256) {
        return amount.mul(3).div(2);
    }

    function mockUnripeLPDeposit(uint256 t, uint32 _s, uint256 amount, uint256 bdv) external {
        _mowLegacy(msg.sender);
        if (t == 0) {
            s.a[msg.sender].lp.deposits[_s] += amount;
            s.a[msg.sender].lp.depositSeeds[_s] += bdv.mul(4);
        }
        else if (t == 1) addDepositToAccountLegacy(msg.sender, C.unripeLPPool1(), _s, amount, bdv);
        else if (t == 2) addDepositToAccountLegacy(msg.sender, C.unripeLPPool2(), _s, amount, bdv);
        uint256 unripeLP = getUnripeForAmount(t, amount);
        bdv = bdv.mul(C.initialRecap()).div(1e18);
        LibTokenSilo.incrementTotalDeposited(C.UNRIPE_LP, unripeLP, bdv);
        uint256 seeds = bdv.mul(LibLegacyTokenSilo.getSeedsPerToken(C.UNRIPE_LP));
        uint256 stalk = bdv.mul(s.ss[C.UNRIPE_LP].stalkIssuedPerBdv).add(stalkRewardLegacy(seeds, _season() - _s));
        LibSilo.mintStalk(msg.sender, stalk);
        uint256 newBdv = s.a[msg.sender].mowStatuses[C.UNRIPE_LP].bdv.add(amount);
        s.a[msg.sender].mowStatuses[C.UNRIPE_LP].bdv = uint128(newBdv);
        LibTransfer.receiveToken(IERC20(C.UNRIPE_LP), unripeLP, msg.sender, LibTransfer.From.EXTERNAL);
    }

   function mockUnripeBeanDeposit(uint32 _s, uint256 amount) external {
        _mowLegacy(msg.sender);
        s.a[msg.sender].bean.deposits[_s] += amount;
        uint256 partialAmount = amount.mul(C.initialRecap()).div(1e18);
        LibTokenSilo.incrementTotalDeposited(C.UNRIPE_BEAN, amount, partialAmount);
        
        uint256 seeds = partialAmount.mul(LibLegacyTokenSilo.getSeedsPerToken(C.UNRIPE_BEAN));
        uint256 stalk = partialAmount.mul(s.ss[C.UNRIPE_BEAN].stalkIssuedPerBdv).add(stalkRewardLegacy(seeds, _season() - _s));
        
        LibSilo.mintStalk(msg.sender, stalk);
        mintSeeds(msg.sender, seeds);
        uint256 newBdv = s.a[msg.sender].mowStatuses[C.UNRIPE_BEAN].bdv.add(partialAmount);
        s.a[msg.sender].mowStatuses[C.UNRIPE_BEAN].bdv = uint128(newBdv);
        LibTransfer.receiveToken(IERC20(C.UNRIPE_BEAN), amount, msg.sender, LibTransfer.From.EXTERNAL);
    }

    modifier mowSenderLegacy() {
        _mowLegacy(msg.sender);
        _;
    }

    /**
     * @dev Claims the Grown Stalk for `account` and applies it to their Stalk
     * balance.
     *
     * A Farmer cannot receive Seeds unless the Farmer's `lastUpdate` Season is
     * equal to the current Season. Otherwise, they would receive extra Grown
     * Stalk when they receive Seeds.
     *
     * This is why `_mow()` must be called before any actions that change Seeds,
     * including:
     *  - {SiloFacet-deposit}
     *  - {SiloFacet-withdrawDeposit}
     *  - {SiloFacet-withdrawDeposits}
     *  - {_plant}
     *  - {SiloFacet-transferDeposit(s)}
     */
    function _mowLegacy(address account) internal {
        uint32 _lastUpdate = lastUpdate(account);

        // If `account` was already updated this Season, there's no Stalk to Mow.
        // _lastUpdate > _season() should not be possible, but it is checked anyway.
        if (_lastUpdate >= _season()) return;

        // Increments `plenty` for `account` if a Flood has occured.
        // Saves Rain Roots for `account` if it is Raining.
        handleRainAndSopsLegacy(account, _lastUpdate);

        // Calculate the amount of Grown Stalk claimable by `account`.
        // Increase the account's balance of Stalk and Roots.
        __mowLegacy(account);

        // Reset timer so that Grown Stalk for a particular Season can only be 
        // claimed one time. 
        s.a[account].lastUpdate = _season();
    }

    function __mowLegacy(address account) private {
        // If this `account` has no Seeds, skip to save gas.
        if (s.a[account].s.seeds == 0) return;
        LibSilo.mintStalk(account, balanceOfGrownStalkLegacy(account));
    }

    function handleRainAndSopsLegacy(address account, uint32 _lastUpdate) private {
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

    function balanceOfGrownStalkLegacy(address account)
        public
        view
        returns (uint256)
    {
        return
            LibLegacyTokenSilo.stalkReward(
                s.a[account].s.seeds,
                _season() - lastUpdate(account)
            );
    }

    //mock adding seeds to account for legacy tests
    function mintSeeds(address account, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Increase supply of Seeds; Add Seeds to the balance of `account`
        s.s.deprecated_seeds = s.s.deprecated_seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);

        // emit SeedsBalanceChanged(account, int256(seeds)); //don't really care about the event for unit testing purposes of unripe stuff
    }

    function getUnripeForAmount(uint256 t, uint256 amount) private pure returns (uint256) {
        if (t == 0) return amount.mul(AMOUNT_TO_BDV_BEAN_ETH).div(1e18);
        else if (t == 1) return amount.mul(AMOUNT_TO_BDV_BEAN_3CRV).div(1e18);
        else return amount.mul(AMOUNT_TO_BDV_BEAN_LUSD).div(1e18);
    }

    /**
     * @dev Add `amount` of `token` to a user's Deposit in `season`. Requires a
     * precalculated `bdv`.
     *
     * If a Deposit doesn't yet exist, one is created. Otherwise, the existing
     * Deposit is updated.
     * 
     * `amount` & `bdv` are cast uint256 -> uint128 to optimize storage cost,
     * since both values can be packed into one slot.
     * 
     * Unlike {removeDepositFromAccount}, this function DOES EMIT an 
     * {AddDeposit} event. See {removeDepositFromAccount} for more details.
     */
    function addDepositToAccountLegacy(
        address account,
        address token,
        uint32 season,
        uint256 amount,
        uint256 bdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.a[account].legacyDeposits[token][season].amount += uint128(amount);
        s.a[account].legacyDeposits[token][season].bdv += uint128(bdv);

        emit AddDeposit(account, token, season, amount, bdv);
    }

        //////////////////////// ADD DEPOSIT ////////////////////////

    /**
     * @return seeds The amount of Seeds received for this Deposit.
     * @return stalk The amount of Stalk received for this Deposit.
     * 
     * @dev Calculate the current BDV for `amount` of `token`, then perform 
     * Deposit accounting.
     */
    function libTokenSiloDepositLegacy(
        address account,
        address token,
        uint32 season,
        uint256 amount
    ) internal returns (uint256, uint256) {
        uint256 bdv = beanDenominatedValueLegacy(token, amount);
        return depositWithBDVLegacy(account, token, season, amount, bdv);
    }

    //no mowSender(token) here because modern mowSender requires migration
    //old deposits would have happened before migration, we're just trying to mock here
    function depositLegacy(
        address token,
        uint256 amount,
        LibTransfer.From mode
    ) external payable nonReentrant mowSenderLegacy {
        amount = LibTransfer.receiveToken(
            IERC20(token),
            amount,
            msg.sender,
            mode
        );
        _depositLegacy(msg.sender, token, amount);
    }

    function _depositLegacy(
        address account,
        address token,
        uint256 amount
    ) internal {
        (uint256 seeds, uint256 stalk) = libTokenSiloDepositLegacy(
            account,
            token,
            _season(),
            amount
        );
        LibSilo.mintStalk(account, stalk);
        mintSeeds(account, seeds);
    }

    /**
     * @dev Once the BDV received for Depositing `amount` of `token` is known, 
     * add a Deposit for `account` and update the total amount Deposited.
     *
     * `s.ss[token].seeds` stores the number of Seeds per BDV for `token`.
     * `s.ss[token].stalk` stores the number of Stalk per BDV for `token`.
     *
     * FIXME(discuss): If we think of Deposits like 1155s, we might call the
     * combination of "incrementTotalDeposited" and "addDepositToAccount" as 
     * "minting a deposit".
     */
    function depositWithBDVLegacy(
        address account,
        address token,
        uint32 season,
        uint256 amount,
        uint256 bdv
    ) internal returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(bdv > 0, "Silo: No Beans under Token.");

        LibTokenSilo.incrementTotalDeposited(token, amount, bdv); // Update Totals
        addDepositToAccountLegacy(account, token, season, amount, bdv); // Add to Account

        return (
            bdv.mul(getSeedsPerToken(token)), //for adequate testing may need to grab seeds per token
            bdv.mul(s.ss[token].stalkIssuedPerBdv)
        );
    }

    function beanDenominatedValueLegacy(address token, uint256 amount)
        internal
        returns (uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // BDV functions accept one argument: `uint256 amount`
        bytes memory callData = abi.encodeWithSelector(
            s.ss[token].selector,
            amount
        );

        (bool success, bytes memory data) = address(this).call(
            callData
        );

        if (!success) {
            if (data.length == 0) revert();
            assembly {
                revert(add(32, data), mload(data))
            }
        }

        assembly {
            bdv := mload(add(data, add(0x20, 0)))
        }
    }

    function balanceOfSeeds(address account) public view returns (uint256) {
        return s.a[account].s.seeds;
    }
    
    function totalSeeds() public view returns (uint256) {
        return s.s.deprecated_seeds;
    }

    //function not needed because we'll manually setup these initial values from the bip script?
    //however it's referenced in the InitWhitelist.sol code
    function whitelistTokenLegacy(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.ss[token].selector = selector;
        s.ss[token].stalkIssuedPerBdv = stalkIssuedPerBdv; //previously just called "stalk"
        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason; //previously called "seeds"

        s.ss[token].milestoneSeason = s.season.current;

        // emit WhitelistToken(token, selector, stalkEarnedPerSeason, stalkIssuedPerBdv);
    }

    function getSeedsPerToken(address token) public pure override returns (uint256) { //could be pure without console log?
        if (token == C.BEAN) {
            return 2;
        } else if (token == C.UNRIPE_BEAN) {
            return 2;
        } else if (token == C.UNRIPE_LP) {
            return 4;
        } else if (token == C.CURVE_BEAN_METAPOOL) {
            return 4;
        }
        
        return 1; //return 1 instead of zero so we can use 1 for testing purposes on stuff that hasn't been whitelisted (like in Convert.test)
    }

    function stalkRewardLegacy(uint256 seeds, uint32 seasons)
        internal
        pure
        returns (uint256)
    {
        return seeds.mul(seasons);
    }
}