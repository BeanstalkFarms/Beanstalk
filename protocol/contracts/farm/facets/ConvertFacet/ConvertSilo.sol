
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

/**
 * @author Publius
 * @title Bean Silo
**/
contract ConvertSilo {

    AppStorage internal s;

    using SafeMath for uint256;
    using SafeMath for uint32;
    
    event TokenRemove(address indexed account, address indexed token, uint32[] seasons, uint256[] amounts, uint256 amount);

    struct WithdrawState {
        uint256 newLP;
        uint256 beansAdded;
        uint256 beansTransferred;
        uint256 beansRemoved;
        uint256 stalkRemoved;
        uint256 i;
    }

    struct TokenConvert {
        uint256 bdvRemoved;
        uint256 tokenRemoved;
        uint256 depositToken;
        uint256 depositedBDV;
    }

    function _convertAddAndDepositLP(
        address token,
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory seasons,
        uint256[] memory amounts
    )
        internal
    {
	    LibInternal.updateSilo(msg.sender);
        WithdrawState memory w;
        if (C.bean().balanceOf(address(this)) < al.beanAmount) {
            w.beansTransferred = al.beanAmount.sub(s.bean.deposited);
            C.bean().transferFrom(msg.sender, address(this), w.beansTransferred);
        }
        (w.beansAdded, w.newLP) = LibMarket.addLiquidity(al); // w.beansAdded is beans added to LP
        require(w.newLP > 0, "Silo: No LP added.");
        (w.beansRemoved, w.stalkRemoved) = _withdrawBeansForConvert(seasons, amounts, w.beansAdded); // w.beansRemoved is beans removed from Silo
        uint256 amountFromWallet = w.beansAdded.sub(w.beansRemoved, "Silo: Removed too many Beans.");

        if (amountFromWallet < w.beansTransferred) {
            C.bean().transfer(msg.sender, w.beansTransferred.sub(amountFromWallet));
	    } else if (w.beansTransferred < amountFromWallet) {
            uint256 transferAmount = amountFromWallet.sub(w.beansTransferred);
            LibMarket.allocatedBeans(transferAmount);
        }

        w.i = w.stalkRemoved.div(LibTokenSilo.beanDenominatedValue(token, lp.add(w.newLP)), "Silo: No LP Beans.");
        uint32 depositSeason = uint32(season().sub(w.i.div(s.ss[token].seeds)));

        if (lp > 0) pair().transferFrom(msg.sender, address(this), lp);
	
        lp = lp.add(w.newLP);
        _deposit(depositSeason, lp, LibTokenSilo.beanDenominatedValue(token, lp));
        LibCheck.beanBalanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    /**
     * Internal LP
    **/

    function _deposit(uint32 _s, uint256 amount, uint256 lpb) internal {
        LibTokenSilo.depositWithBDV(msg.sender, s.c.pair, _s, amount, lpb);
        uint256 seeds = lpb.mul(s.ss[s.c.pair].seeds);
        uint256 stalk = lpb.mul(s.ss[s.c.pair].stalk);
        if (_s > 0) stalk = stalk.add((season().sub(_s)).mul(seeds));
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);
    }

    function _withdrawForConvert(
        address token,
        uint32[] memory crates,
        uint256[] memory amounts,
        uint256 maxLP
    )
        internal
        returns (uint256 stalkRemoved)
    {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        TokenConvert memory tokenConvert;
        uint256 i = 0;
        while ((i < crates.length) && (tokenConvert.tokenRemoved < maxLP)) {
            if (tokenConvert.tokenRemoved.add(amounts[i]) < maxLP)
                (tokenConvert.depositToken, tokenConvert.depositedBDV) = LibTokenSilo.removeDeposit(msg.sender, token, crates[i], amounts[i]);
            else
                (tokenConvert.depositToken, tokenConvert.depositedBDV) = LibTokenSilo.removeDeposit(msg.sender, token, crates[i], maxLP.sub(tokenConvert.tokenRemoved));
            tokenConvert.tokenRemoved = tokenConvert.tokenRemoved.add(tokenConvert.depositToken);
            tokenConvert.bdvRemoved = tokenConvert.bdvRemoved.add(tokenConvert.depositedBDV);
            stalkRemoved = stalkRemoved.add(LibSilo.stalkReward(tokenConvert.depositedBDV.mul(s.ss[token].seeds), season()-crates[i]));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = tokenConvert.depositToken;
        while (i < crates.length) {
            amounts[i] = 0;
            i++;
        }
        LibTokenSilo.decrementDepositedToken(token, tokenConvert.tokenRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, tokenConvert.bdvRemoved.mul(s.ss[token].seeds), stalkRemoved.add(tokenConvert.bdvRemoved.mul(s.ss[token].stalk)));
        emit TokenRemove(token, msg.sender, crates, amounts, tokenConvert.tokenRemoved);
    }

    /**
     * Internal Bean
    **/

    function _depositBeans(uint256 amount, uint32 _s) internal {
        require(amount > 0, "Silo: No beans.");
        LibTokenSilo.incrementDepositedToken(C.beanAddress(), amount);
        uint256 stalk = amount.mul(C.getStalkPerBean());
        uint256 seeds = amount.mul(C.getSeedsPerBean());
        if (_s < season()) stalk = stalk.add(LibSilo.stalkReward(seeds, season()-_s));
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);
        LibBeanSilo.addBeanDeposit(msg.sender, _s, amount);
        LibCheck.beanBalanceCheck();
    }

    function _withdrawBeansForConvert(
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxBeans
    )
        internal
        returns (uint256 beansRemoved, uint256 stalkRemoved)
    {
        require(seasons.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        uint256 crateBeans;
        uint256 i = 0;
        while ((i < seasons.length) && (beansRemoved < maxBeans)) {
            if (beansRemoved.add(amounts[i]) < maxBeans)
                crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, seasons[i], amounts[i]);
            else
                crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, seasons[i], maxBeans.sub(beansRemoved));
            beansRemoved = beansRemoved.add(crateBeans);
            stalkRemoved = stalkRemoved.add(
                LibSilo.stalkReward(crateBeans.mul(C.getSeedsPerBean()), season()-seasons[i])
            );
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = crateBeans;
        while (i < seasons.length) {
            amounts[i] = 0;
            i++;
        }
        LibTokenSilo.decrementDepositedToken(C.beanAddress(), beansRemoved);
        LibSilo.withdrawSiloAssets(
            msg.sender, 
            beansRemoved.mul(C.getSeedsPerBean()), 
            stalkRemoved.add(beansRemoved.mul(C.getStalkPerBean()))
        );
        emit TokenRemove(msg.sender, C.beanAddress(), seasons, amounts, beansRemoved);
        return (beansRemoved, stalkRemoved);
    }

    function reserves() internal view returns (uint256, uint256) {
        (uint112 reserve0, uint112 reserve1,) = pair().getReserves();
        return (s.index == 0 ? reserve1 : reserve0,s.index == 0 ? reserve0 : reserve1);
    }

    function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }

    function season() internal view returns (uint32) {
        return s.season.current;
    }
}