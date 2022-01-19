/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../LibAppStorage.sol";

/**
 * @author Publius
 * @title Lib Token Silo
**/
library LibTokenSilo {

    using SafeMath for uint256;
    using SafeMath for uint112;
    
<<<<<<< HEAD
    event TokenDeposit(address indexed account, uint256 season, uint256 token_amount, uint256 seeds, address token);
=======
    event TokenDeposit(address indexed account, uint256 season, uint256 token_amount, uint256 bdv, address token);
>>>>>>> 417f47a664f9682150ff37d2c8ab7c237f7a2317

    function incrementDepositedToken(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[IERC20(token)].deposited = s.siloBalances[IERC20(token)].deposited.add(amount);
    }

    function decrementDepositedToken(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[IERC20(token)].deposited = s.siloBalances[IERC20(token)].deposited.sub(amount);
    }

<<<<<<< HEAD
    function addDeposit(address token, address account, uint32 _s, uint256 amount, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].deposits[IERC20(token)][_s].tokens += uint112(amount);
        s.a[account].deposits[IERC20(token)][_s].seeds += uint112(seeds);
        emit TokenDeposit(msg.sender, _s, amount, seeds, token);
=======
    function addDeposit(address token, address account, uint32 _s, uint256 amount, uint256 bdv) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].deposits[IERC20(token)][_s].tokens += uint112(amount);
        s.a[account].deposits[IERC20(token)][_s].bdv += uint112(bdv);
        emit TokenDeposit(msg.sender, _s, amount, bdv, token);
>>>>>>> 417f47a664f9682150ff37d2c8ab7c237f7a2317
    }

    function removeDeposit(address token, address account, uint32 id, uint256 amount)
        internal
        returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(id <= s.season.current, "Silo: Future crate.");
        (uint256 crateAmount, uint256 crateBase) = tokenDeposit(token, account, id);
        require(crateAmount >= amount, "Silo: Crate balance too low.");
        require(crateAmount > 0, "Silo: Crate empty.");
        if (amount < crateAmount) {
            uint112 base = uint112(amount.mul(crateBase).div(crateAmount));
            s.a[account].deposits[IERC20(token)][id].tokens -= uint112(amount);
<<<<<<< HEAD
            s.a[account].deposits[IERC20(token)][id].seeds -= base;
            return (amount, base);
        } else {
            delete s.a[account].deposits[IERC20(token)][id].tokens;
            delete s.a[account].deposits[IERC20(token)][id].seeds;
=======
            s.a[account].deposits[IERC20(token)][id].bdv -= base;
            return (amount, base);
        } else {
            delete s.a[account].deposits[IERC20(token)][id].tokens;
            delete s.a[account].deposits[IERC20(token)][id].bdv;
>>>>>>> 417f47a664f9682150ff37d2c8ab7c237f7a2317
            return (crateAmount, crateBase);
        }
    }

    function tokenDeposit(address token, address account, uint32 id) private view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
<<<<<<< HEAD
        return (s.a[account].deposits[IERC20(token)][id].tokens, s.a[account].deposits[IERC20(token)][id].seeds);
=======
        return (s.a[account].deposits[IERC20(token)][id].tokens, s.a[account].deposits[IERC20(token)][id].bdv);
>>>>>>> 417f47a664f9682150ff37d2c8ab7c237f7a2317
    }

    function beanDenominatedValue(address token, uint256 amount) internal returns (uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
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
