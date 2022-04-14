/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;
import "../../../libraries/Silo/LibTokenSilo.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/LibInternal.sol";
import "../SiloFacet/BeanSilo.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Token Silo
**/
contract TokenSilo {
	
	AppStorage internal s;
    
	uint32 private constant ASSET_PADDING = 100;
    
	using SafeMath for uint256;
	using SafeMath for uint32;
    
	event Deposit(address indexed account, address indexed token, uint256 season, uint256 amount, uint256 bdv);
    event RemoveSeasons(address indexed account, address indexed token, uint32[] seasons, uint256[] amounts, uint256 amount);
    event RemoveSeason(address indexed account, address indexed token, uint32 season, uint256 amount);
    event Withdraw(address indexed account, address indexed token, uint32 season, uint256 amount);
    event ClaimSeasons(address indexed account, address indexed token, uint32[] seasons, uint256 amount);
    event ClaimSeason(address indexed account, address indexed token, uint32 season, uint256 amount);
    
	struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 seedsRemoved;
        uint256 bdvRemoved;
    }
    
	/**
     * Getters
    **/

	function getDeposit(address account, address token, uint32 season) external view returns (uint256, uint256) {
		if (token == address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)) {
			uint256 bd = s.a[account].bean.deposits[season];
			return (bd, bd);
        } else if (token == address(0x87898263B6C5BABe34b4ec53F22d98430b91e371)) {
			return (s.a[account].lp.deposits[season], s.a[account].lp.depositSeeds[season]);
        } else {
            return LibTokenSilo.tokenDeposit(account, token, season);
        }
    }

    function getWithdrawal(address account, address token, uint32 season) external view returns (uint256) {
        if (token == address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)) {
            return s.a[account].bean.withdrawals[season];
        } else if (token == address(0x87898263B6C5BABe34b4ec53F22d98430b91e371)) {
			return s.a[account].lp.withdrawals[season];
        } else {
            return LibTokenSilo.tokenWithdrawal(account, token, season);
        }
    }

    function getTotalDeposited(address token) external view returns (uint256) {
        if (token == address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)) {
            return s.bean.deposited;
        } else if (token == address(0x87898263B6C5BABe34b4ec53F22d98430b91e371)) {
            return s.lp.deposited;
        } else {
            return s.siloBalances[token].deposited;
        }
    }

    function getTotalWithdrawn(address token) external view returns (uint256) {
        if (token == address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)) {
            return s.bean.withdrawn;
        } else if (token == address(0x87898263B6C5BABe34b4ec53F22d98430b91e371)) {
            return s.lp.withdrawn;
        } else {
            return s.siloBalances[token].withdrawn;
        }
    }

    /**
     * Internal
    **/

    function _deposit(address token, uint256 amount) internal {
		LibInternal.updateSilo(msg.sender);
        if (token == address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)) {
			require(amount > 0, "Silo: No beans.");
			LibBeanSilo.incrementDepositedBeans(amount);
			LibSilo.depositSiloAssets(msg.sender, amount.mul(C.getSeedsPerBean()), amount.mul(C.getStalkPerBean()));
			LibBeanSilo.addBeanDeposit(msg.sender, _season(), amount);
        } else if (token == address(0x87898263B6C5BABe34b4ec53F22d98430b91e371)) {
			uint32 _s = _season();
			uint256 lpb = LibLPSilo.lpToLPBeans(amount);
			console.log("amount", amount);
			console.log("lpb", lpb);
			require(lpb > 0, "Silo: No Beans under LP.");
			LibLPSilo.incrementDepositedLP(amount);
			uint256 seeds = lpb.mul(C.getSeedsPerLPBean());
			if (_season() == _s) LibSilo.depositSiloAssets(msg.sender, seeds, lpb.mul(10000));
			else LibSilo.depositSiloAssets(msg.sender, seeds, lpb.mul(10000).add(_season().sub(_s).mul(seeds)));
			LibLPSilo.addLPDeposit(msg.sender, _s, amount, lpb.mul(C.getSeedsPerLPBean()));
			LibCheck.lpBalanceCheck();
        } else {
			(uint256 seeds, uint256 stalk) = LibTokenSilo.deposit(msg.sender, token, _season(), amount);
			LibSilo.depositSiloAssets(msg.sender, seeds, stalk);
        }
    }

    function _withdrawDeposits(address token, uint32[] calldata seasons, uint256[] calldata amounts) internal {
        require(seasons.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        if (token == address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)) {
			LibInternal.updateSilo(msg.sender);
			(uint256 beansRemoved, uint256 stalkRemoved) = LibBeanSilo.removeBeanDeposits(seasons, amounts);
			LibBeanSilo.addBeanWithdrawal(msg.sender, _season()+s.season.withdrawSeasons, beansRemoved);
			LibBeanSilo.decrementDepositedBeans(beansRemoved);
			LibSilo.withdrawSiloAssets(msg.sender, beansRemoved.mul(C.getSeedsPerBean()), stalkRemoved);
			LibCheck.beanBalanceCheck();
        } else if (token == address(0x87898263B6C5BABe34b4ec53F22d98430b91e371)) {
			LibInternal.updateSilo(msg.sender);
			(
				uint256 lpRemoved,
				uint256 stalkRemoved,
				uint256 seedsRemoved
			) = LibLPSilo.removeLPDeposits(seasons, amounts);
			uint32 arrivalSeason = _season() + s.season.withdrawSeasons;
			LibLPSilo.addLPWithdrawal(msg.sender, arrivalSeason, lpRemoved);
			LibLPSilo.decrementDepositedLP(lpRemoved);
			LibSilo.withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
			LibCheck.lpBalanceCheck();
        } else {
			AssetsRemoved memory ar = removeDeposits(token, seasons, amounts);
			uint32 arrivalSeason = _season() + s.season.withdrawSeasons;
			addTokenWithdrawal(msg.sender, token, arrivalSeason, ar.tokensRemoved);
			LibTokenSilo.decrementDepositedToken(token, ar.tokensRemoved);
			LibSilo.withdrawSiloAssets(msg.sender, ar.seedsRemoved, ar.stalkRemoved);
		}
    }

    function _withdrawDeposit(address token, uint32 season, uint256 amount) internal {
        if (token == address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)) {
			revert("For Beans, use _withdrawDeposits, not _withdrawDeposit");
        } else if (token == address(0x87898263B6C5BABe34b4ec53F22d98430b91e371)) {
			revert("For LP, use _withdrawDeposits, not _withdrawDeposit");
        } else {
			AssetsRemoved memory ar = removeDeposit(token, season, amount);
			uint32 arrivalSeason = _season() + s.season.withdrawSeasons;
			addTokenWithdrawal(msg.sender, token, arrivalSeason, ar.tokensRemoved);
			LibTokenSilo.decrementDepositedToken(token, ar.tokensRemoved);
			LibSilo.withdrawSiloAssets(msg.sender, ar.seedsRemoved, ar.stalkRemoved);
        }
    }

    function _transferDeposits(address token, uint32[] calldata seasons, uint256[] calldata amounts, address transferTo) internal {
        require(seasons.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        if (token == address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)) {
			(uint256 beansRemoved, uint256 stalkRemoved) = LibBeanSilo.removeBeanDeposits(seasons, amounts);
			LibSilo.withdrawSiloAssets(msg.sender, beansRemoved.mul(C.getSeedsPerBean()), stalkRemoved);
			for (uint256 i = 0; i < seasons.length; i++) {
				LibBeanSilo.addBeanDeposit(transferTo, seasons[i], amounts[i]);
			}
			LibSilo.depositSiloAssets(transferTo, beansRemoved.mul(C.getSeedsPerBean()), stalkRemoved);
			LibSilo.updateBalanceOfRainStalk(transferTo);
			LibCheck.beanBalanceCheck();
        } else if (token == address(0x87898263B6C5BABe34b4ec53F22d98430b91e371)) {
			LibLPSilo.transferLPDeposits(seasons, amounts, transferTo);
			LibSilo.updateBalanceOfRainStalk(transferTo);
			LibCheck.lpBalanceCheck();
        } else {
			AssetsRemoved memory ar;
			for (uint256 i = 0; i < seasons.length; i++) {
				ar = removeDeposit(token, seasons[i], amounts[i]);
				LibSilo.withdrawSiloAssets(msg.sender, ar.seedsRemoved, ar.stalkRemoved);
				LibTokenSilo.transferWithBDV(transferTo, token, seasons[i], ar.tokensRemoved, ar.bdvRemoved);
				LibSilo.depositSiloAssets(transferTo, ar.seedsRemoved, ar.stalkRemoved);
			}
		}
    }

    function _transferDeposit(address token, uint32 season, uint256 amount, address transferTo) internal {
        if (token == address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db)) {
			revert("For Beans, use _transferDeposits, not _transferDeposit");
        } else if (token == address(0x87898263B6C5BABe34b4ec53F22d98430b91e371)) {
			revert("For LP, use _transferDeposits, not _transferDeposit");
        } else {
			AssetsRemoved memory ar = removeDeposit(token, season, amount);
			LibSilo.withdrawSiloAssets(msg.sender, ar.seedsRemoved, ar.stalkRemoved);
			LibTokenSilo.transferWithBDV(transferTo, token, season, ar.tokensRemoved, ar.bdvRemoved);
			LibSilo.depositSiloAssets(transferTo, ar.seedsRemoved, ar.stalkRemoved);
		}
    }

    function removeDeposit(address token, uint32 season, uint256 amount)
        private
        returns (AssetsRemoved memory ar)
    {
        (ar.tokensRemoved, ar.bdvRemoved) = LibTokenSilo.removeDeposit(
            msg.sender,
            token,
            season,
            amount
        );
        ar.seedsRemoved = ar.bdvRemoved.mul(s.ss[token].seeds);
        ar.stalkRemoved = ar.bdvRemoved.mul(s.ss[token].stalk).add(
            LibSilo.stalkReward(ar.seedsRemoved, _season()-season)
        );
        emit RemoveSeason(msg.sender, token, season, amount);
    }

    function removeDeposits(address token, uint32[] calldata seasons, uint256[] calldata amounts)
        private
        returns (AssetsRemoved memory ar)
    {
        uint256 bdvRemoved;
        for (uint256 i = 0; i < seasons.length; i++) {
            (uint256 crateTokens, uint256 crateBdv) = LibTokenSilo.removeDeposit(
                msg.sender,
                token,
                seasons[i],
                amounts[i]
            );
            bdvRemoved = bdvRemoved.add(crateBdv);
            ar.bdvRemoved = bdvRemoved;
            ar.tokensRemoved = ar.tokensRemoved.add(crateTokens);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(crateBdv.mul(s.ss[token].seeds), _season()-seasons[i])
            );
        }
        ar.seedsRemoved = bdvRemoved.mul(s.ss[token].seeds);
        ar.stalkRemoved = ar.stalkRemoved.add(bdvRemoved.mul(s.ss[token].stalk));
        emit RemoveSeasons(msg.sender, token, seasons, amounts, ar.tokensRemoved);
    }

    function addTokenWithdrawal(address account, address token, uint32 arrivalSeason, uint256 amount) private {
        s.a[account].withdrawals[token][arrivalSeason] = s.a[account].withdrawals[token][arrivalSeason].add(amount);
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.add(amount);
        emit Withdraw(msg.sender, token, arrivalSeason, amount);
    }

    function removeTokenWithdrawals(address account, address token, uint32[] calldata seasons) internal returns (uint256 amount) {
        for (uint256 i = 0; i < seasons.length; i++) {
            amount = amount.add(_removeTokenWithdrawal(account, token, seasons[i]));
        }
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(amount);
        return amount;
    }

    function removeTokenWithdrawal(address account, address token, uint32 season) internal returns (uint256) {
        uint256 amount = _removeTokenWithdrawal(account, token, season);
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(amount);
        return amount;
    }

    function _removeTokenWithdrawal(address account, address token, uint32 season) private returns (uint256) {
        uint256 amount = s.a[account].withdrawals[token][season];
        delete s.a[account].withdrawals[token][season];
        return amount;
    }

    function _season() private view returns (uint32) {
        return s.season.current;
    }
}
