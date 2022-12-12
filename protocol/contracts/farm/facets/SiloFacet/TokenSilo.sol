/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

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
        uint32 season,
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


    event DepositApproval(
        address indexed owner,
        address indexed spender,
        address token,
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


    function getTotalDeposited(address token) external view returns (uint256) {
        return s.siloBalances[token].deposited;
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
    ) internal returns (uint256) {
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
        return ar.tokensRemoved;
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
        LibTokenSilo.decrementTotalDeposited(token, amount);
        LibSilo.burnSeedsAndStalk(account, seeds, stalk);
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
        for (uint256 i; i < seasons.length; ++i) {
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

    // Transfer

    function _transferDeposit(
        address sender,
        address recipient,
        address token,
        uint32 season,
        uint256 amount
    ) internal returns (uint256) {
        (uint256 stalk, uint256 seeds, uint256 bdv) = removeDeposit(
            sender,
            token,
            season,
            amount
        );
        LibTokenSilo.addDeposit(recipient, token, season, amount, bdv);
        LibSilo.transferSiloAssets(sender, recipient, seeds, stalk);
        return bdv;
    }

    function _transferDeposits(
        address sender,
        address recipient,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) internal returns (uint256[] memory) {
        require(
            seasons.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );
        AssetsRemoved memory ar;
        uint256[] memory bdvs = new uint256[](seasons.length);

        for (uint256 i; i < seasons.length; ++i) {
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
            bdvs[i] = crateBdv;
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
        return bdvs;
    }

    function _spendDepositAllowance(
        address owner,
        address spender,
        address token,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = depositAllowance(owner, spender, token);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "Silo: insufficient allowance");
            _approveDeposit(owner, spender, token, currentAllowance - amount);
        }
    }
        
    function _approveDeposit(address account, address spender, address token, uint256 amount) internal {
        s.a[account].depositAllowances[spender][token] = amount;
        emit DepositApproval(account, spender, token, amount);
    }

    function depositAllowance(
        address account,
        address spender,
        address token
    ) public view virtual returns (uint256) {
        return s.a[account].depositAllowances[spender][token];
    }

    function _season() private view returns (uint32) {
        return s.season.current;
    }
}
