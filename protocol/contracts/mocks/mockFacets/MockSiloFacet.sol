/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../beanstalk/silo/SiloFacet/SiloFacet.sol";
import "../../libraries/Silo/LibWhitelist.sol";
import "hardhat/console.sol";

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
       LibWhitelist.whitelistTokenLegacy(token, selector, stalk, stalkEarnedPerSeason);
    }

    function mockBDV(uint256 amount) external pure returns (uint256) {
        return amount;
    }

    function mockBDVIncrease(uint256 amount) external pure returns (uint256) {
        return amount.mul(3).div(2);
    }

    function mockUnripeLPDeposit(uint256 t, uint32 _s, uint256 amount, uint256 bdv) external {
        _mow(msg.sender, C.unripeLPAddress());
        if (t == 0) {
            s.a[msg.sender].lp.deposits[_s] += amount;
            s.a[msg.sender].lp.depositSeeds[_s] += bdv.mul(4);
        }
        else if (t == 1) addDepositToAccountLegacy(msg.sender, C.unripeLPPool1(), _s, amount, bdv);
        else if (t == 2) addDepositToAccountLegacy(msg.sender, C.unripeLPPool2(), _s, amount, bdv);
        uint256 unripeLP = getUnripeForAmount(t, amount);
        LibTokenSilo.incrementTotalDeposited(C.unripeLPAddress(), unripeLP);
        bdv = bdv.mul(C.initialRecap()).div(1e18);
        uint256 seeds = bdv.mul(LibLegacyTokenSilo.getSeedsPerToken(C.unripeLPAddress()));
        uint256 stalk = bdv.mul(s.ss[C.unripeLPAddress()].stalkIssuedPerBdv).add(LibSilo.stalkRewardLegacy(seeds, _season() - _s));
        LibSilo.mintStalk(msg.sender, stalk);
        uint256 newBdv = s.a[msg.sender].mowStatuses[C.unripeLPAddress()].bdv.add(amount);
        s.a[msg.sender].mowStatuses[C.unripeLPAddress()].bdv = uint128(newBdv);
        LibTransfer.receiveToken(IERC20(C.unripeLPAddress()), unripeLP, msg.sender, LibTransfer.From.EXTERNAL);
    }

   function mockUnripeBeanDeposit(uint32 _s, uint256 amount) external {
        _mow(msg.sender, C.unripeBeanAddress());
        s.a[msg.sender].bean.deposits[_s] += amount;
        LibTokenSilo.incrementTotalDeposited(C.unripeBeanAddress(), amount);
        amount = amount.mul(C.initialRecap()).div(1e18);
        uint256 seeds = amount.mul(LibLegacyTokenSilo.getSeedsPerToken(C.unripeBeanAddress()));
        uint256 stalk = amount.mul(s.ss[C.unripeBeanAddress()].stalkIssuedPerBdv).add(LibSilo.stalkRewardLegacy(seeds, _season() - _s));
        LibSilo.mintStalk(msg.sender, stalk);
        mintSeeds(msg.sender, seeds);
        uint256 newBdv = s.a[msg.sender].mowStatuses[C.unripeBeanAddress()].bdv.add(amount);
        s.a[msg.sender].mowStatuses[C.unripeBeanAddress()].bdv = uint128(newBdv);
        LibTransfer.receiveToken(IERC20(C.unripeBeanAddress()), amount, msg.sender, LibTransfer.From.EXTERNAL);
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

    function depositLegacy(
        address token,
        uint256 amount,
        LibTransfer.From mode
    ) external payable nonReentrant mowSender(token) {
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

        LibTokenSilo.incrementTotalDeposited(token, amount); // Update Totals
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

    /**
     * @dev Locate the `amount` and `bdv` for a user's Deposit in storage.
     *
     * Silo V2 Deposits are stored within each {Account} as a mapping of:
     *  `address token => uint32 season => { uint128 amount, uint128 bdv }`
     *
     * Unripe BEAN and Unripe LP are handled independently so that data
     * stored in the legacy Silo V1 format and the new Silo V2 format can
     * be appropriately merged. See {LibUnripeSilo} for more information.
     *
     * FIXME(naming): rename to `getDeposit()`?
     */
    function getDepositLegacy(
        address account,
        address token,
        uint32 season
    ) external view returns (uint128, uint128) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (LibUnripeSilo.isUnripeBean(token)){
            (uint256 amount, uint256 bdv) = LibUnripeSilo.unripeBeanDeposit(account, season);
            return (uint128(amount), uint128(bdv));
        }
        if (LibUnripeSilo.isUnripeLP(token)){
            (uint256 amount, uint256 bdv) = LibUnripeSilo.unripeLPDeposit(account, season);
            return (uint128(amount), uint128(bdv));
        }

        return (
            s.a[account].legacyDeposits[token][season].amount,
            s.a[account].legacyDeposits[token][season].bdv
        );
    }

    function balanceOfSeeds(address account) public view returns (uint256) {
        return s.a[account].s.seeds;
    }
    
    function totalSeeds() public view returns (uint256) {
        return s.s.deprecated_seeds;
    }

    function getSeedsPerToken(address token) public pure override returns (uint256) { //could be pure without console log?
        if (token == C.beanAddress()) {
            return 2;
        } else if (token == C.unripeBeanAddress()) {
            return 2;
        } else if (token == C.unripeLPAddress()) {
            return 4;
        } else if (token == C.curveMetapoolAddress()) {
            return 4;
        }
        return 1; //return 1 instead of zero so we can use 1 for testing purposes on stuff that hasn't been whitelisted (like in Convert.test)
    }
}