/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./ConvertSilo.sol";
import "../../../libraries/LibConvert.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibClaim.sol";
import "../../../libraries/Silo/LibLegacyLPSilo.sol";

/**
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
**/
contract ConvertFacet is ConvertSilo {

    using SafeMath for uint256;
    using SafeMath for uint32;

    function convertDepositedBeans(
        uint256 beans,
        uint256 minLP,
        uint32[] memory crates,
        uint256[] memory amounts
    )
        external 
    {
        Storage.Settings memory set = defaultSettings();
        LibInternal.updateSilo(msg.sender);
        (uint256 lp, uint256 beansConverted) = LibConvert.sellToPegAndAddLiquidity(beans, minLP);
        (uint256 beansRemoved, uint256 stalkRemoved) = _withdrawBeansForConvert(crates, amounts, beansConverted);
        require(beansRemoved == beansConverted, "Silo: Wrong Beans removed.");
        uint32 _s = uint32(stalkRemoved.div(beansConverted.mul(s.ss[s.c.pair].seeds)));
        _s = getDepositSeason(_s);

        _deposit(s.c.pair, _s, lp, beansConverted, set.toInternalBalance);
        LibCheck.balanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }   

    function convertDepositedLP(
        uint256 lp,
        uint256 minBeans,
        uint32[] memory crates,
        uint256[] memory amounts
    )
        external
    {
        Storage.Settings memory set = defaultSettings();
        LibInternal.updateSilo(msg.sender);
        (uint256 beans, uint256 lpConverted) = LibConvert.removeLPAndBuyToPeg(lp, minBeans);
        uint256 stalkRemoved = _withdrawForConvert(s.c.pair, crates, amounts, lpConverted, set.fromInternalBalance);
        uint32 _s = uint32(stalkRemoved.div(beans.mul(C.getSeedsPerBean())));
        _s = getDepositSeason(_s);
        _depositBeans(beans, _s, set.toInternalBalance);
        LibCheck.balanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function convertDepositedLegacyLP(
        uint256 lp,
        uint256 minBeans,
        uint32[] memory crates,
        uint256[] memory amounts,
        bool[] memory legacy
    )
        external
    {
        Storage.Settings memory set = defaultSettings();
        LibInternal.updateSilo(msg.sender);
        (uint256 beans, uint256 lpConverted) = LibConvert.removeLPAndBuyToPeg(lp, minBeans);
        uint256 stalkRemoved = LibLegacyLPSilo.removeLPDepositsForConvert(
            crates, 
            amounts, 
            legacy,
            lpConverted,
            set.fromInternalBalance
        );
        uint32 _s = uint32(stalkRemoved.div(beans.mul(C.getSeedsPerBean())));
        _s = getDepositSeason(_s);
        _depositBeans(beans, _s, set.toInternalBalance);
        LibCheck.balanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function claimConvertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
        LibClaim.Claim calldata claim
    )
        external
        payable
    {
        Storage.Settings memory set = defaultSettings();
        LibClaim.claim(claim);
        _convertAddAndDepositLP(lp, al, crates, amounts, set.toInternalBalance);
    }

    function convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts
    )
        public
        payable
    {
        Storage.Settings memory set = defaultSettings();
        _convertAddAndDepositLP(lp, al, crates, amounts, set.toInternalBalance);
    }

    function convertDepositedBeansAndCirculatingStalkSeed(
        uint256 beans,
        uint32[] memory crates,
        uint256[] memory amounts
    )
        public
        payable
    {
        Storage.Settings memory set = defaultSettings();
        _convertDepositedBeansAndCirculatingStalkSeed(s.beanSeedStalk3Pair, beans, crates, amounts, set.toInternalBalance, set.fromInternalBalance);
    }

    function lpToPeg() external view returns (uint256 lp) {
        return LibConvert.lpToPeg();
    }

    function beansToPeg() external view returns (uint256 beans) {
        (uint256 ethReserve, uint256 beanReserve) = reserves();
        return LibConvert.beansToPeg(ethReserve, beanReserve);
    }

    function getDepositSeason(uint32 _s) internal view returns (uint32) {
        uint32 __s = season();
        if (_s >= __s) _s = __s - 1;
        return uint32(__s.sub(_s));
    }
}