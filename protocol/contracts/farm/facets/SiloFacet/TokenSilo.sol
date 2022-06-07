/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/LibSafeMath32.sol";
import "./Silo.sol";

/**
 * @author Publius
 * @title Token Silo
 **/
contract TokenSilo is Silo {
    uint32 private constant ASSET_PADDING = 100;

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    event AddDeposit(
        address indexed account,
        address indexed token,
        uint256 season,
        uint256 amount,
        uint256 bdv
    );
    event RemoveDeposits(
        address indexed account,
        address indexed token,
        uint32[] seasons,
        uint256[] amounts,
        uint256 amount
    );
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
    );

    event AddWithdrawal(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
    );
    event RemoveWithdrawals(
        address indexed account,
        address indexed token,
        uint32[] seasons,
        uint256 amount
    );
    event RemoveWithdrawal(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
    );

    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 seedsRemoved;
        uint256 bdvRemoved;
    }

    /**
     * Getters
     **/

    function getDeposit(
        address account,
        address token,
        uint32 season
    ) external view returns (uint256, uint256) {
        return LibTokenSilo.tokenDeposit(account, token, season);
    }

    function getWithdrawal(
        address account,
        address token,
        uint32 season
    ) external view returns (uint256) {
        return LibTokenSilo.tokenWithdrawal(account, token, season);
    }

    function getTotalDeposited(address token) external view returns (uint256) {
        return s.siloBalances[token].deposited;
    }

    function getTotalWithdrawn(address token) external view returns (uint256) {
        return s.siloBalances[token].withdrawn;
    }

    function tokenSettings(address token)
        external
        view
        returns (Storage.SiloSettings memory)
    {
        return s.ss[token];
    }

    function withdrawFreeze() public view returns (uint8) {
        return s.season.withdrawSeasons;
    }

    /**
     * Internal
     **/

    // Deposit

    function _deposit(
        address account,
        address token,
        uint256 amount
    ) internal {
        (uint256 seeds, uint256 stalk) = LibTokenSilo.deposit(
            account,
            token,
            _season(),
            amount
        );
        LibSilo.depositSiloAssets(account, seeds, stalk);
    }

    // Withdraw

    function _withdrawDeposits(
        address account,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) internal {
        require(
            seasons.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );
        AssetsRemoved memory ar = removeDeposits(
            account,
            token,
            seasons,
            amounts
        );
        _withdraw(
            account,
            token,
            ar.tokensRemoved,
            ar.stalkRemoved,
            ar.seedsRemoved
        );
    }

    function _withdrawDeposit(
        address account,
        address token,
        uint32 season,
        uint256 amount
    ) internal {
        (uint256 stalkRemoved, uint256 seedsRemoved, ) = removeDeposit(
            account,
            token,
            season,
            amount
        );
        _withdraw(account, token, amount, stalkRemoved, seedsRemoved);
    }

    function _withdraw(
        address account,
        address token,
        uint256 amount,
        uint256 stalk,
        uint256 seeds
    ) private {
        uint32 arrivalSeason = _season() + s.season.withdrawSeasons;
        addTokenWithdrawal(account, token, arrivalSeason, amount);
        LibTokenSilo.decrementDepositedToken(token, amount);
        LibSilo.withdrawSiloAssets(account, seeds, stalk);
    }

    function removeDeposit(
        address account,
        address token,
        uint32 season,
        uint256 amount
    )
        private
        returns (
            uint256 stalkRemoved,
            uint256 seedsRemoved,
            uint256 bdv
        )
    {
        bdv = LibTokenSilo.removeDeposit(account, token, season, amount);
        seedsRemoved = bdv.mul(s.ss[token].seeds);
        stalkRemoved = bdv.mul(s.ss[token].stalk).add(
            LibSilo.stalkReward(seedsRemoved, _season() - season)
        );
        emit RemoveDeposit(account, token, season, amount);
    }

    function removeDeposits(
        address account,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) internal returns (AssetsRemoved memory ar) {
        for (uint256 i = 0; i < seasons.length; i++) {
            uint256 crateBdv = LibTokenSilo.removeDeposit(
                account,
                token,
                seasons[i],
                amounts[i]
            );
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    crateBdv.mul(s.ss[token].seeds),
                    _season() - seasons[i]
                )
            );
        }
        ar.seedsRemoved = ar.bdvRemoved.mul(s.ss[token].seeds);
        ar.stalkRemoved = ar.stalkRemoved.add(
            ar.bdvRemoved.mul(s.ss[token].stalk)
        );
        emit RemoveDeposits(account, token, seasons, amounts, ar.tokensRemoved);
    }

    function addTokenWithdrawal(
        address account,
        address token,
        uint32 arrivalSeason,
        uint256 amount
    ) private {
        s.a[account].withdrawals[token][arrivalSeason] = s
        .a[account]
        .withdrawals[token][arrivalSeason].add(amount);
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.add(
            amount
        );
        emit AddWithdrawal(account, token, arrivalSeason, amount);
    }

        // Claim

    function _claimWithdrawal(
        address account,
        address token,
        uint32 season
    ) internal returns (uint256) {
        uint256 amount = _removeTokenWithdrawal(account, token, season);
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(
            amount
        );
        emit RemoveWithdrawal(msg.sender, token, season, amount);
        return amount;
    }

    function _claimWithdrawals(
        address account,
        address token,
        uint32[] calldata seasons
    ) internal returns (uint256 amount) {
        for (uint256 i = 0; i < seasons.length; i++) {
            amount = amount.add(
                _removeTokenWithdrawal(account, token, seasons[i])
            );
        }
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(
            amount
        );
        emit RemoveWithdrawals(msg.sender, token, seasons, amount);
        return amount;
    }

    function _removeTokenWithdrawal(
        address account,
        address token,
        uint32 season
    ) private returns (uint256) {
        require(
            season <= s.season.current,
            "Claim: Withdrawal not recievable."
        );
        uint256 amount = s.a[account].withdrawals[token][season];
        delete s.a[account].withdrawals[token][season];
        return amount;
    }

    // Transfer

    function _transferDeposit(
        address sender,
        address recipient,
        address token,
        uint32 season,
        uint256 amount
    ) internal {
        (uint256 stalk, uint256 seeds, uint256 bdv) = removeDeposit(
            sender,
            token,
            season,
            amount
        );
        LibTokenSilo.addDeposit(recipient, token, season, amount, bdv);
        LibSilo.transferSiloAssets(sender, recipient, seeds, stalk);
    }

    function _transferDeposits(
        address sender,
        address recipient,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) internal {
        require(
            seasons.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );
        AssetsRemoved memory ar;
        for (uint256 i = 0; i < seasons.length; i++) {
            uint256 crateBdv = LibTokenSilo.removeDeposit(
                sender,
                token,
                seasons[i],
                amounts[i]
            );
            LibTokenSilo.addDeposit(
                recipient,
                token,
                seasons[i],
                amounts[i],
                crateBdv
            );
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    crateBdv.mul(s.ss[token].seeds),
                    _season() - seasons[i]
                )
            );
        }
        ar.seedsRemoved = ar.bdvRemoved.mul(s.ss[token].seeds);
        ar.stalkRemoved = ar.stalkRemoved.add(
            ar.bdvRemoved.mul(s.ss[token].stalk)
        );
        emit RemoveDeposits(sender, token, seasons, amounts, ar.tokensRemoved);
        LibSilo.transferSiloAssets(
            sender,
            recipient,
            ar.seedsRemoved,
            ar.stalkRemoved
        );
    }

    function _season() private view returns (uint32) {
        return s.season.current;
    }
}
