/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../AppStorage.sol";
import "../../libraries/LibCheck.sol";
import "../../libraries/LibInternal.sol";
import "../../libraries/LibClaim.sol";

/**
 * @author Publius
 * @title Claim handles claiming Bean and LP withdrawals, harvesting plots and claiming Ether.
**/
contract ClaimFacet {

    event BeanClaim(address indexed account, uint32[] withdrawals, uint256 beans);
    event LPClaim(address indexed account, uint32[] withdrawals, uint256 lp);
    event EtherClaim(address indexed account, uint256 ethereum);
    event Harvest(address indexed account, uint256[] plots, uint256 beans);
    event BeanAllocation(address indexed account, uint256 beans);

    using SafeMath for uint256;

    AppStorage internal s;

    function claim(LibClaim.Claim calldata c) public payable returns (uint256 beansClaimed) {
        beansClaimed = LibClaim.claim(c);

        LibCheck.balanceCheck();
    }

    function claimAndUnwrapBeans(LibClaim.Claim calldata c, uint256 amount) public payable returns (uint256 beansClaimed) {
        beansClaimed = LibClaim.claim(c);
        beansClaimed = beansClaimed.add(unwrapBeans(amount));

        LibCheck.balanceCheck();
    }

    function claimBeans(uint32[] calldata withdrawals) public payable {
        uint256 beansClaimed = LibClaim.claimBeans(withdrawals);
        IBean(s.c.bean).transfer(msg.sender, beansClaimed);
        LibCheck.beanBalanceCheck();
    }

    function claimLP(uint32[] calldata withdrawals) public payable {
        LibClaim.claimLP(withdrawals);
        LibCheck.lpBalanceCheck();
    }

    function removeAndClaimLP(
        uint32[] calldata withdrawals,
        uint256 minBeanAmount,
        uint256 minEthAmount
    )
        public
	payable
    {
        LibClaim.removeAndClaimLP(withdrawals, minBeanAmount, minEthAmount);
        LibCheck.balanceCheck();
    }

    function harvest(uint256[] calldata plots) public payable {
        uint256 beansHarvested = LibClaim.harvest(plots);
        IBean(s.c.bean).transfer(msg.sender, beansHarvested);
        LibCheck.beanBalanceCheck();
    }

    function claimEth() public payable {
        LibClaim.claimEth();
    }

    function unwrapBeans(uint amount) public payable returns (uint256 beansToWallet) {
        if (amount == 0) return beansToWallet;
        uint256 wBeans = s.internalTokenBalance[msg.sender][IBean(s.c.bean)];

        if (amount > wBeans) {
            IBean(s.c.bean).transfer(msg.sender, wBeans);
            beansToWallet = s.internalTokenBalance[msg.sender][IBean(s.c.bean)];
            LibUserBalance._decreaseInternalBalance(msg.sender, IBean(s.c.bean), wBeans, false);
        } else {
            IBean(s.c.bean).transfer(msg.sender, amount);
	          LibUserBalance._decreaseInternalBalance(msg.sender, IBean(s.c.bean), amount, false);
            beansToWallet = amount;
        }
    }

    function wrapBeans(uint amount) public payable {
        IBean(s.c.bean).transferFrom(msg.sender, address(this), amount);
	      LibUserBalance._increaseInternalBalance(msg.sender, IBean(s.c.bean), amount);
    }

    function wrappedBeans(address user) public view returns (uint256) {
        return s.internalTokenBalance[user][IBean(s.c.bean)];
    }

    function wrapTokens(uint256 amount, address token) public payable {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        LibUserBalance._increaseInternalBalance(msg.sender, IERC20(token), amount);
    }

    function unwrapTokens(uint256 amount, address token) public payable returns (uint256 tokensUnwrapped) {
        if (amount == 0) return tokensUnwrapped;
        uint256 wrapped = s.internalTokenBalance[msg.sender][IERC20(token)];

        if (amount > wrapped) {
            IERC20(token).transfer(msg.sender, wrapped);
            tokensUnwrapped = s.internalTokenBalance[msg.sender][IERC20(token)];
            LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(token), wrapped, false);
        } else {
            IERC20(token).transfer(msg.sender, amount);
	          LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(token), amount, false);
            tokensUnwrapped = amount;
        }
    }
}
