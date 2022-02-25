
/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibBeanSilo.sol";
import "../../../libraries/Silo/LibLPSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";
import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Bean Silo
**/
contract ConvertDeposit {

    AppStorage internal s;

    using SafeMath for uint256;
    using SafeMath for uint32;
    
    struct WithdrawState {
        uint256 newLP;
        uint256 beansAdded;
        uint256 beansTransferred;
        uint256 beansRemoved;
        uint256 stalkRemoved;
        uint256 i;
    }

    /**
     * Internal LP
    **/

    function _depositTokens(address token, uint256 amount, uint256 bdv, uint256 bonusStalk) internal {
        require(bdv > 0, "Silo: No Beans under LP.");
        uint256 seeds = s.ss[token].seeds.mul(bdv);
        uint32 _s;
        if (bonusStalk > 0) {
            uint32 _s = uint32(bonusStalk.div(seeds));
            bonusStalk = _s.mul(seeds);
        } 
        _s = getDepositSeason(_s);(_s);
        uint256 stalk = bdv.mul(s.ss[token].stalk).add(bonusStalk);
        LibSilo.depositSiloAssets(msg.sender, seeds, bdv.mul(s.ss[token].stalk).add(bonusStalk));

        if (token == s.c.bean) {
            LibBeanSilo.incrementDepositedBeans(amount);
            LibBeanSilo.addBeanDeposit(msg.sender, _s, amount);
        } else if (token == s.c.pair) {
            LibLPSilo.incrementDepositedLP(amount);
            LibLPSilo.addLPDeposit(msg.sender, _s, amount, seeds);
        } else {
            LibTokenSilo.incrementDepositedToken(token, amount);
            LibTokenSilo.addDeposit(msg.sender, token, _s, amount, bdv);
        }
    }
    
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

    function _depositLP(uint256 amount, uint256 lpb, uint32 _s) internal {
        require(lpb > 0, "Silo: No Beans under LP.");
        LibLPSilo.incrementDepositedLP(amount);
        uint256 seeds = lpb.mul(C.getSeedsPerLPBean());
        if (season() == _s) LibSilo.depositSiloAssets(msg.sender, seeds, lpb.mul(10000));
        else LibSilo.depositSiloAssets(msg.sender, seeds, lpb.mul(10000).add(season().sub(_s).mul(seeds)));

        LibLPSilo.addLPDeposit(msg.sender, _s, amount, lpb.mul(C.getSeedsPerLPBean()));

        LibCheck.lpBalanceCheck();
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

    function getDepositSeason(uint32 _s) internal view returns (uint32) {
        uint32 __s = season();
        if (_s >= __s) _s = __s - 1;
        return uint32(__s.sub(_s));
    }
}
