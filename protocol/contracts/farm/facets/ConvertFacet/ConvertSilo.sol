/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibBeanSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";
import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";
import "../../../C.sol";
import "../Utils/ToolShed.sol";

/**
 * @author Publius
 * @title Bean Silo
**/
contract ConvertSilo is ToolShed {

    AppStorage internal s;

    using SafeMath for uint256;
    using SafeMath for uint32;
    
    event TokenDeposit(address indexed token, address indexed account, uint256 season, uint256 lp, uint256 seeds);
    event TokenRemove(address indexed token, address indexed account, uint32[] crates, uint256[] crateLP, uint256 lp);
    event BeanRemove(address indexed account, uint32[] crates, uint256[] crateBeans, uint256 beans);

    struct WithdrawState {
        uint256 newLP;
        uint256 beansAdded;
        uint256 beansTransferred;
        uint256 beansRemoved;
        uint256 stalkRemoved;
        uint256 i;
    }

    function _convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
       	bool toInternalBalance
    )
        internal
    {
	    LibInternal.updateSilo(msg.sender);
        WithdrawState memory w;
        if (bean().balanceOf(address(this)) < al.beanAmount) {
            	w.beansTransferred = al.beanAmount.sub(s.bean.deposited);
            	bean().transferFrom(msg.sender, address(this), w.beansTransferred);
        }
        (w.beansAdded, w.newLP) = LibMarket.addLiquidity(al); // w.beansAdded is beans added to LP
        require(w.newLP > 0, "Silo: No LP added.");
        (w.beansRemoved, w.stalkRemoved) = _withdrawBeansForConvert(crates, amounts, w.beansAdded); // w.beansRemoved is beans removed from Silo
        uint256 amountFromWallet = w.beansAdded.sub(w.beansRemoved, "Silo: Removed too many Beans.");

        if (amountFromWallet < w.beansTransferred) {
            bean().transfer(msg.sender, w.beansTransferred.sub(amountFromWallet));
	    } else if (w.beansTransferred < amountFromWallet) {
            uint256 transferAmount = amountFromWallet.sub(w.beansTransferred);
            LibMarket.allocatedBeans(transferAmount);
        }

        w.i = w.stalkRemoved.div(LibTokenSilo.beanDenominatedValue(s.c.pair, lp.add(w.newLP)), "Silo: No LP Beans.");
        uint32 depositSeason = uint32(season().sub(w.i.div(s.ss[s.c.pair].seeds)));

        if (lp > 0) pair().transferFrom(msg.sender, address(this), lp);
	
        lp = lp.add(w.newLP);
        _depositLP(depositSeason, lp, LibTokenSilo.beanDenominatedValue(s.c.pair, lp), toInternalBalance);
        LibCheck.beanBalanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function _convertAddAndDepositBeansAndCirculatingSeedStalk(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
       	bool toInternalBalance
    )
        internal
    {
	    LibInternal.updateSilo(msg.sender);
        WithdrawState memory w;
        if (bean().balanceOf(address(this)) < al.beanAmount) {
            	w.beansTransferred = al.beanAmount.sub(s.bean.deposited);
            	bean().transferFrom(msg.sender, address(this), w.beansTransferred);
        }
        (w.beansAdded, w.newLP) = LibMarket.addLiquidity(al); // w.beansAdded is beans added to LP
        require(w.newLP > 0, "Silo: No LP added.");
        (w.beansRemoved, w.stalkRemoved) = _withdrawBeansForConvert(crates, amounts, w.beansAdded); // w.beansRemoved is beans removed from Silo
        uint256 amountFromWallet = w.beansAdded.sub(w.beansRemoved, "Silo: Removed too many Beans.");

        if (amountFromWallet < w.beansTransferred) {
            bean().transfer(msg.sender, w.beansTransferred.sub(amountFromWallet));
	    } else if (w.beansTransferred < amountFromWallet) {
            uint256 transferAmount = amountFromWallet.sub(w.beansTransferred);
            LibMarket.allocatedBeans(transferAmount);
        }

        w.i = w.stalkRemoved.div(LibTokenSilo.beanDenominatedValue(s.c.pair, lp.add(w.newLP)), "Silo: No LP Beans.");
        uint32 depositSeason = uint32(season().sub(w.i.div(s.seedsPerBDV[s.c.pair])));

        if (lp > 0) pair().transferFrom(msg.sender, address(this), lp);
	
        lp = lp.add(w.newLP);
        _depositLP(lp, LibTokenSilo.beanDenominatedValue(s.c.pair, lp), depositSeason, toInternalBalance);
        LibCheck.beanBalanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    /**
     * Internal Generic Tokens + LP
    **/

    function _depositLP(uint32 _s, uint256 amount, uint256 lpb, bool toInternalBalance) internal {
        LibTokenSilo.depositWithBDV(msg.sender, s.c.pair, _s, amount, lpb);
        uint256 seeds = lpb.mul(s.ss[s.c.pair].seeds);
        uint256 stalk = lpb.mul(s.ss[s.c.pair].stalk);
        if (_s > 0) stalk = stalk.add((season().sub(_s)).mul(seeds));
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk, toInternalBalance);
    }

    // TODO
    // Create Generalized version of this and add seeds removed as return
    // Also decrementing and incrementing should be done at the end without needing to use the withdraw subfunctions
    // this should now be done through a new mixed used increment/decrement function in libsilo
    function _withdrawTokenForConvert(
        uint32[] memory crates,
        uint256[] memory amounts,
        uint256 maxTokenAmount,
        bool fromInternalBalance
    )
        internal
        returns (uint256 tokenRemoved, uint256 stalkRemoved, uint256 seedsRemoved)
    {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        uint256 bdvRemoved;
        uint256 depositTokens;
        uint256 depositedBDV;
        uint256 i = 0;
        while ((i < crates.length) && (tokenRemoved < maxTokenAmount)) {
            if (tokenRemoved.add(amounts[i]) < maxTokenAmount)
                (depositTokens, depositedBDV) = LibTokenSilo.removeDeposit(s.c.pair, msg.sender, crates[i], amounts[i]);
            else
                (depositTokens, depositedBDV) = LibTokenSilo.removeDeposit(s.c.pair, msg.sender, crates[i], maxTokenAmount.sub(tokenRemoved));
            tokenRemoved = tokenRemoved.add(depositTokens);
            bdvRemoved = bdvRemoved.add(depositedBDV);
            stalkRemoved = stalkRemoved.add(LibSilo.stalkReward(depositedBDV.mul(s.seedsPerBDV[s.c.pair]), season()-crates[i]));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = depositTokens;
        while (i < crates.length) {
            amounts[i] = 0;
            i++;
        }
        seedsRemoved = bdvRemoved.mul(s.seedsPerBDV[s.c.pair]);
        LibTokenSilo.decrementDepositedToken(s.c.pair, tokenRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved.add(bdvRemoved.mul(s.stalkPerBDV[s.c.pair])), fromInternalBalance);
        emit TokenRemove(s.c.pair, msg.sender, crates, amounts, tokenRemoved);
    }

    function _withdrawLPForConvert(
        uint32[] memory crates,
        uint256[] memory amounts,
        uint256 maxLP,
        bool fromInternalBalance
    )
        internal
        returns (uint256 stalkRemoved)
    {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        uint256 bdvRemoved;
        uint256 lpRemoved;
        uint256 depositLP;
        uint256 depositedBDV;
        uint256 i = 0;
        while ((i < crates.length) && (lpRemoved < maxLP)) {
            if (lpRemoved.add(amounts[i]) < maxLP)
                (depositLP, depositedBDV) = LibTokenSilo.removeDeposit(msg.sender, s.c.pair, crates[i], amounts[i]);
            else
                (depositLP, depositedBDV) = LibTokenSilo.removeDeposit(msg.sender, s.c.pair, crates[i], maxLP.sub(lpRemoved));
            lpRemoved = lpRemoved.add(depositLP);
            bdvRemoved = bdvRemoved.add(depositedBDV);
            stalkRemoved = stalkRemoved.add(LibSilo.stalkReward(depositedBDV.mul(s.ss[s.c.pair].seeds), season()-crates[i]));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = depositLP;
        while (i < crates.length) {
            amounts[i] = 0;
            i++;
        }
        seedsRemoved = bdvRemoved.mul(s.seedsPerBDV[s.c.pair]);
        LibTokenSilo.decrementDepositedToken(s.c.pair, lpRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, bdvRemoved.mul(s.ss[s.c.pair].seeds), stalkRemoved.add(bdvRemoved.mul(s.ss[s.c.pair].stalk)), fromInternalBalance);
        emit TokenRemove(s.c.pair, msg.sender, crates, amounts, lpRemoved);
    }

    /**
     * Internal Bean
    **/

    // TODO
    // Instead we return stalk and seeds and don't increment seed/stalk balances
    function __depositBeans(
        uint256 amount, 
        uint32 _s
    ) 
        internal 
        returns (uint256 stalk, uint256 seeds) 
    {
        require(amount > 0, "Silo: No beans.");
        LibBeanSilo.incrementDepositedBeans(amount);
        stalk = amount.mul(C.getStalkPerBean());
        seeds = amount.mul(C.getSeedsPerBean());
        if (_s < season()) stalk = stalk.add(LibSilo.stalkReward(seeds, season()-_s));
        LibBeanSilo.addBeanDeposit(msg.sender, _s, amount);
        LibCheck.beanBalanceCheck();
        return (stalk, seeds);
    }

    function _depositBeans(uint256 amount, uint32 _s, bool toInternalBalance) internal {
        (uint256 stalk, uint256 seeds) = __depositBeans(amount, _s);
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk, toInternalBalance);
    }

    function _withdrawBeansForConvert(
        uint32[] memory crates,
        uint256[] memory amounts,
        uint256 maxBeans
    )
        internal
        returns (uint256 beansRemoved, uint256 stalkRemoved)
    {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        uint256 crateBeans;
        uint256 i = 0;
        while ((i < crates.length) && (beansRemoved < maxBeans)) {
            if (beansRemoved.add(amounts[i]) < maxBeans) crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, crates[i], amounts[i]);
            else crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, crates[i], maxBeans.sub(beansRemoved));
            beansRemoved = beansRemoved.add(crateBeans);
            stalkRemoved = stalkRemoved.add(crateBeans.mul(C.getStalkPerBean()).add(
                LibSilo.stalkReward(crateBeans.mul(C.getSeedsPerBean()), season()-crates[i]
            )));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = crateBeans;
        while (i < crates.length) {
            amounts[i] = 0;
            i++;
        }
        LibBeanSilo.decrementDepositedBeans(beansRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, beansRemoved.mul(C.getSeedsPerBean()), stalkRemoved, true);
        stalkRemoved = stalkRemoved.sub(beansRemoved.mul(C.getStalkPerBean()));
        emit BeanRemove(msg.sender, crates, amounts, beansRemoved);
        return (beansRemoved, stalkRemoved);
    }

    function reserves() internal view returns (uint256, uint256) {
        (uint112 reserve0, uint112 reserve1,) = pair().getReserves();
        return (s.index == 0 ? reserve1 : reserve0,s.index == 0 ? reserve0 : reserve1);
    }

    function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }

    function season() internal view returns (uint32) {
        return s.season.current;
    }
}