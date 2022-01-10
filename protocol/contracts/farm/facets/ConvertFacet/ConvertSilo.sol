
/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibBeanSilo.sol";
import "../../../libraries/Silo/LibLPSilo.sol";
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
    
    event LPDeposit(address indexed account, uint256 season, uint256 lp, uint256 seeds);
    event LPRemove(address indexed account, uint32[] crates, uint256[] crateLP, uint256 lp);
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
        uint256[] memory amounts
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

        w.i = w.stalkRemoved.div(LibLPSilo.lpToLPBeans(lp.add(w.newLP)), "Silo: No LP Beans.");
        uint32 depositSeason = uint32(season().sub(w.i.div(C.getSeedsPerLPBean())));

        if (lp > 0) pair().transferFrom(msg.sender, address(this), lp);
	
        lp = lp.add(w.newLP);
        _depositLP(lp, LibLPSilo.lpToLPBeans(lp), depositSeason);
        LibCheck.beanBalanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    /**
     * Internal LP
    **/

    function _depositLP(uint256 amount, uint256 lpb, uint32 _s) internal {
        require(lpb > 0, "Silo: No Beans under LP.");
        LibLPSilo.incrementDepositedLP(amount);
        uint256 seeds = lpb.mul(C.getSeedsPerLPBean());
        if (season() == _s) LibSilo.depositSiloAssets(msg.sender, seeds, lpb.mul(10000));
        else LibSilo.depositSiloAssets(msg.sender, seeds, lpb.mul(10000).add(season().sub(_s).mul(seeds)));

        LibLPSilo.addLPDeposit(msg.sender, _s, amount, lpb.mul(C.getSeedsPerLPBean()));

        LibCheck.lpBalanceCheck();
    }

    function _withdrawLPForConvert(
        uint32[] memory crates,
        uint256[] memory amounts,
        uint256 maxLP
    )
        internal
        returns (uint256 lpRemoved, uint256 stalkRemoved)
    {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        uint256 seedsRemoved;
        uint256 depositLP;
        uint256 depositSeeds;
        uint256 i = 0;
        while ((i < crates.length) && (lpRemoved < maxLP)) {
            if (lpRemoved.add(amounts[i]) < maxLP)
                (depositLP, depositSeeds) = LibLPSilo.removeLPDeposit(msg.sender, crates[i], amounts[i]);
            else
                (depositLP, depositSeeds) = LibLPSilo.removeLPDeposit(msg.sender, crates[i], maxLP.sub(lpRemoved));
            lpRemoved = lpRemoved.add(depositLP);
            seedsRemoved = seedsRemoved.add(depositSeeds);
            stalkRemoved = stalkRemoved.add(depositSeeds.mul(C.getStalkPerLPSeed()).add(
                LibSilo.stalkReward(depositSeeds, season()-crates[i]
            )));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = depositLP;
        while (i < crates.length) {
            amounts[i] = 0;
            i++;
        }
        LibLPSilo.decrementDepositedLP(lpRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
        stalkRemoved = stalkRemoved.sub(seedsRemoved.mul(C.getStalkPerLPSeed()));
        emit LPRemove(msg.sender, crates, amounts, lpRemoved);
    }

    /**
     * Internal Bean
    **/

    function _depositBeans(uint256 amount, uint32 _s) internal {
        require(amount > 0, "Silo: No beans.");
        LibBeanSilo.incrementDepositedBeans(amount);
        uint256 stalk = amount.mul(C.getStalkPerBean());
        uint256 seeds = amount.mul(C.getSeedsPerBean());
        if (_s < season()) stalk = stalk.add(LibSilo.stalkReward(seeds, season()-_s));
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);
        LibBeanSilo.addBeanDeposit(msg.sender, _s, amount);
        LibCheck.beanBalanceCheck();
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
            if (beansRemoved.add(amounts[i]) < maxBeans)
                crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, crates[i], amounts[i]);
            else
                crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, crates[i], maxBeans.sub(beansRemoved));
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
        LibSilo.withdrawSiloAssets(msg.sender, beansRemoved.mul(C.getSeedsPerBean()), stalkRemoved);
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
