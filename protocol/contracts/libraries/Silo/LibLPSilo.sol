/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../LibAppStorage.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Lib LP Silo
**/
library LibLPSilo {

    using SafeMath for uint256;
    using SafeMath for uint112;
    
    event LPDeposit(address indexed account, uint256 season, uint256 lp, uint256 seeds, address lp_address);

    function incrementDepositedLP(address lp_address, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.lp_balances[IERC20(lp_address)].deposited = s.lp_balances[IERC20(lp_address)].deposited.add(amount);
    }

    function decrementDepositedLP(address lp_address, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.lp_balances[IERC20(lp_address)].deposited = s.lp_balances[IERC20(lp_address)].deposited.sub(amount);
    }

    function addLPDeposit(address lp_address, address account, uint32 _s, uint256 amount, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].deposits[IERC20(lp_address)][_s].tokens += uint112(amount);
        s.a[account].deposits[IERC20(lp_address)][_s].seeds += uint112(seeds);
        emit LPDeposit(msg.sender, _s, amount, seeds, lp_address);
    }

    function removeLPDeposit(address lp_address, address account, uint32 id, uint256 amount)
        internal
        returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(id <= s.season.current, "Silo: Future crate.");
        (uint256 crateAmount, uint256 crateBase) = lpDeposit(lp_address, account, id);
        require(crateAmount >= amount, "Silo: Crate balance too low.");
        require(crateAmount > 0, "Silo: Crate empty.");
        if (amount < crateAmount) {
            uint112 base = uint112(amount.mul(crateBase).div(crateAmount));
            s.a[account].deposits[IERC20(lp_address)][id].tokens -= uint112(amount);
            s.a[account].deposits[IERC20(lp_address)][id].seeds -= base;
            return (amount, base);
        } else {
            delete s.a[account].deposits[IERC20(lp_address)][id].tokens;
            delete s.a[account].deposits[IERC20(lp_address)][id].seeds;
            return (crateAmount, crateBase);
        }
    }

    function lpDeposit(address lp_address, address account, uint32 id) private view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return (s.a[account].deposits[IERC20(lp_address)][id].tokens, s.a[account].deposits[IERC20(lp_address)][id].seeds);
    }

    function beanDenominatedValue(address token, uint256 amount) internal returns (uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // console.log(s.siloFunctions[token]);
        console.logBytes4(s.siloFunctions[token]);
        console.log(token);
        console.log(s.c.pair);
        console.log("123");
        bytes memory myFunctionCall = abi.encodeWithSelector(s.siloFunctions[token], token, amount);
        (bool success, bytes memory data) = address(this).delegatecall(myFunctionCall);
        require(success, "Silo: Bean denominated value failed.");
        assembly { bdv := mload(add(data, add(0x20, 0))) }
    }

    function lpToLPBeans(address lp_address, uint256 amount) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(s.c.pair).getReserves();

        uint256 beanReserve = s.index == 0 ? reserve0 : reserve1;
        return amount.mul(beanReserve).mul(2).div(IUniswapV2Pair(s.c.pair).totalSupply());
    }
}
