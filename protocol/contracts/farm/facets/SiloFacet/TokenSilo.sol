/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./UpdateSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";

/**
 * @author Publius
 * @title Token Silo
**/
contract TokenSilo is UpdateSilo {

    using SafeMath for uint256;
    using SafeMath for uint32;

<<<<<<< HEAD
    event TokenDeposit(address indexed account, uint256 season, uint256 token_amount, uint256 seeds);
=======
    event TokenDeposit(address indexed account, uint256 season, uint256 token_amount, uint256 bdv);
>>>>>>> 417f47a664f9682150ff37d2c8ab7c237f7a2317
    event TokenRemove(address indexed account, uint32[] crates, uint256[] crateTokens, uint256 token_amount);
    event TokenWithdraw(address indexed account, uint256 season, uint256 token_amount);

    struct AssetsRemoved {
        uint256 tokensRemoved; 
        uint256 stalkRemoved; 
        uint256 seedsRemoved;
    }

    /**
     * Getters
    **/

    function tokenDeposit(address token, address account, uint32 id) public view returns (uint256, uint256) {
<<<<<<< HEAD
        return (s.a[account].deposits[IERC20(token)][id].tokens, s.a[account].deposits[IERC20(token)][id].seeds);
=======
        return (s.a[account].deposits[IERC20(token)][id].tokens, s.a[account].deposits[IERC20(token)][id].bdv);
>>>>>>> 417f47a664f9682150ff37d2c8ab7c237f7a2317
    }

    function tokenWithdrawal(address token, address account, uint32 i) public view returns (uint256) {
        return s.a[account].withdrawals[IERC20(token)][i];
    }

    // V2 For All Token Types
    function totalDepositedToken(address token) public view returns (uint256) {
        return s.siloBalances[IERC20(token)].deposited;
    }

    function totalWithdrawnToken(address token) public view returns (uint256) {
        return s.siloBalances[IERC20(token)].withdrawn;
    }

    function deposit(address token, uint256 amount) public {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        _deposit(token, amount);
    }

    function withdraw(address token, uint32[] calldata crates, uint256[] calldata amounts) public {
        _withdraw(token, crates, amounts);
    }

    /**
     * Internal
    **/

    function _deposit(address token, uint256 amount) internal {
        updateSilo(msg.sender);
        uint256 bdv = LibTokenSilo.beanDenominatedValue(token, amount);
        require(bdv > 0, "Silo: No Beans under Token.");
        LibTokenSilo.incrementDepositedToken(token, amount);
        uint256 seeds = bdv.mul(s.seedsPerBDV[token]);
<<<<<<< HEAD
        LibSilo.depositSiloAssets(msg.sender, seeds, bdv.mul(10000));

        LibTokenSilo.addDeposit(token, msg.sender, season(), amount, bdv.mul(s.seedsPerBDV[token]));
=======
        LibSilo.depositSiloAssets(msg.sender, seeds, bdv.mul(s.stalkPerBDV[token]));

        LibTokenSilo.addDeposit(token, msg.sender, season(), amount, bdv);
>>>>>>> 417f47a664f9682150ff37d2c8ab7c237f7a2317
    }

    function _withdraw(address token, uint32[] calldata crates, uint256[] calldata amounts) internal {
        updateSilo(msg.sender);
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        
        AssetsRemoved memory assetsRemoved = removeDeposits(token, crates, amounts);

        uint32 arrivalSeason = season() + s.season.withdrawBuffer;
        addTokenWithdrawal(token, msg.sender, arrivalSeason, assetsRemoved.tokensRemoved);
        LibTokenSilo.decrementDepositedToken(token, assetsRemoved.tokensRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, assetsRemoved.seedsRemoved, assetsRemoved.stalkRemoved);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function removeDeposits(address token, uint32[] calldata crates, uint256[] calldata amounts)
        private
        returns (AssetsRemoved memory assetsRemoved)
    {
        for (uint256 i = 0; i < crates.length; i++) {
<<<<<<< HEAD
            (uint256 crateBeans, uint256 crateSeeds) = LibTokenSilo.removeDeposit(
=======
            (uint256 crateBeans, uint256 crateBdv) = LibTokenSilo.removeDeposit(
>>>>>>> 417f47a664f9682150ff37d2c8ab7c237f7a2317
                token,
                msg.sender,
                crates[i],
                amounts[i]
            );
<<<<<<< Updated upstream
            tokensRemoved = tokensRemoved.add(crateBeans);
<<<<<<< HEAD
            stalkRemoved = stalkRemoved.add(crateSeeds.mul(C.getStalkPerLPSeed()).add(
                LibSilo.stalkReward(crateSeeds, season()-crates[i]))
            );
            seedsRemoved = seedsRemoved.add(crateSeeds);
=======
            stalkRemoved = stalkRemoved.add(crateBdv.mul(s.stalkPerBDV[token]).add(
                LibSilo.stalkReward(crateBdv, season()-crates[i]))
            );
            seedsRemoved = seedsRemoved.add(crateBdv.mul(s.seedsPerBDV[token]));
>>>>>>> 417f47a664f9682150ff37d2c8ab7c237f7a2317
=======
            assetsRemoved.tokensRemoved = assetsRemoved.tokensRemoved.add(crateBeans);
            assetsRemoved.stalkRemoved = assetsRemoved.stalkRemoved.add(crateBdv.mul(s.stalkPerBDV[token]).add(
                LibSilo.stalkReward(crateBdv, season()-crates[i]))
            );
            assetsRemoved.seedsRemoved = assetsRemoved.seedsRemoved.add(crateBdv.mul(s.seedsPerBDV[token]));
>>>>>>> Stashed changes
        }
        emit TokenRemove(msg.sender, crates, amounts, assetsRemoved.tokensRemoved);
    }

    function addTokenWithdrawal(address token, address account, uint32 arrivalSeason, uint256 amount) private {
        s.a[account].withdrawals[IERC20(token)][arrivalSeason] = s.a[account].withdrawals[IERC20(token)][arrivalSeason].add(amount);
        s.siloBalances[IERC20(token)].withdrawn = s.siloBalances[IERC20(token)].withdrawn.add(amount);
        emit TokenWithdraw(msg.sender, arrivalSeason, amount);
    }

    function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }
}
