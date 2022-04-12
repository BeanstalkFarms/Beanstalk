/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./LibAppStorage.sol";
import "../interfaces/IBean.sol";

import "hardhat/console.sol";

/**
 * @author Publius
 * @title Check Library verifies Beanstalk's balances are correct.
**/
library LibCheck {

    using SafeMath for uint256;

    function beanBalanceCheck() internal view {
        AppStorage storage s = LibAppStorage.diamondStorage();
		console.log("IBean(s.c.bean).balanceOf(address(this))", IBean(s.c.bean).balanceOf(address(this))); 
		console.log("s.f.harvestable", s.f.harvestable); 
		console.log("s.f.harvested", s.f.harvested); 
		console.log("s.bean.deposited", s.bean.deposited); 
		console.log("s.bean.withdrawn", s.bean.withdrawn); 
        require(
            IBean(s.c.bean).balanceOf(address(this)) >=
                s.f.harvestable.sub(s.f.harvested).add(s.bean.deposited).add(s.bean.withdrawn),
            "Check: Bean balance fail."
        );
    }

    function lpBalanceCheck() internal view {
        AppStorage storage s = LibAppStorage.diamondStorage();
		console.log("IBean(s.c.pair).balanceOf(address(this))", IBean(s.c.pair).balanceOf(address(this))); 
		console.log("s.lp.deposited", s.lp.deposited); 
		console.log("s.lp.withdrawn", s.lp.withdrawn); 
        require(
            IUniswapV2Pair(s.c.pair).balanceOf(address(this)) >= s.lp.deposited.add(s.lp.withdrawn),
            "Check: LP balance fail."
        );
    }

    function balanceCheck() internal view {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(
            IBean(s.c.bean).balanceOf(address(this)) >=
                s.f.harvestable.sub(s.f.harvested).add(s.bean.deposited).add(s.bean.withdrawn),
            "Check: Bean balance fail."
        );
        require(
            IUniswapV2Pair(s.c.pair).balanceOf(address(this)) >= s.lp.deposited.add(s.lp.withdrawn),
            "Check: LP balance fail."
        );
    }

}
