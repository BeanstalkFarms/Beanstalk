/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../AppStorage.sol";
import "../../libraries/LibCheck.sol";
import "../../libraries/LibInternal.sol";
import "../../libraries/LibMarket.sol";
import "../../libraries/LibClaim.sol";
import "../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Claim handles claiming Bean and LP withdrawals, harvesting plots and claiming Ether.
**/
contract ClaimFacet is ReentrancyGuard {

    event BeanClaim(address indexed account, uint32[] withdrawals, uint256 beans);
    event LPClaim(address indexed account, uint32[] withdrawals, uint256 lp);
    event EtherClaim(address indexed account, uint256 ethereum);
    event Harvest(address indexed account, uint256[] plots, uint256 beans);
    event BeanAllocation(address indexed account, uint256 beans);

    using SafeMath for uint256;

    function claim(LibClaim.Claim calldata c) external payable nonReentrant returns (uint256 beansClaimed) {
        beansClaimed = LibClaim.claim(c);
        LibMarket.claimRefund(c);
        LibCheck.balanceCheck();
    }

    function claimAndUnwrapBeans(LibClaim.Claim calldata c, uint256 amount) external payable nonReentrant returns (uint256 beansClaimed) {
        beansClaimed = LibClaim.claim(c);
        beansClaimed = beansClaimed.add(_unwrapBeans(amount));
        LibMarket.claimRefund(c);
        LibCheck.balanceCheck();
    }

    function claimBeans(uint32[] calldata withdrawals) external {
        uint256 beansClaimed = LibClaim.claimBeans(withdrawals);
        IBean(s.c.bean).transfer(msg.sender, beansClaimed);
        LibCheck.beanBalanceCheck();
    }

    function claimLP(uint32[] calldata withdrawals) external {
        LibClaim.claimLP(withdrawals);
        LibCheck.lpBalanceCheck();
    }

    function removeAndClaimLP(
        uint32[] calldata withdrawals,
        uint256 minBeanAmount,
        uint256 minEthAmount
    )
        external
        nonReentrant
    {
        LibClaim.removeAndClaimLP(withdrawals, minBeanAmount, minEthAmount);
        LibCheck.balanceCheck();
    }

    function harvest(uint256[] calldata plots) external {
        uint256 beansHarvested = LibClaim.harvest(plots);
        IBean(s.c.bean).transfer(msg.sender, beansHarvested);
        LibCheck.beanBalanceCheck();
    }

    function claimEth() external {
        LibClaim.claimEth();
    }

    function unwrapBeans(uint amount) external returns (uint256 beansToWallet) {
        return _unwrapBeans(amount);
    }

    function _unwrapBeans(uint amount) private returns (uint256 beansToWallet) {
        if (amount == 0) return beansToWallet;
        uint256 wBeans = s.a[msg.sender].wrappedBeans;

        if (amount > wBeans) {
            IBean(s.c.bean).transfer(msg.sender, wBeans);
            beansToWallet = s.a[msg.sender].wrappedBeans;
            s.a[msg.sender].wrappedBeans = 0;
        } else {
            IBean(s.c.bean).transfer(msg.sender, amount);
            s.a[msg.sender].wrappedBeans = wBeans.sub(amount);
            beansToWallet = amount;
        }
    }

    function wrapBeans(uint amount) external {
        IBean(s.c.bean).transferFrom(msg.sender, address(this), amount);
        s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(amount);

    }

    function wrappedBeans(address user) public view returns (uint256) {
        return s.a[user].wrappedBeans;
    }
}
