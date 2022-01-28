/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../AppStorage.sol";
import "../../libraries/LibCheck.sol";
import "../../libraries/LibInternal.sol";
import "../../libraries/LibMarket.sol";
import "../../libraries/LibClaim.sol";

/**
 * @author Publius
 * @title Claim handles claiming Bean and LP withdrawals, harvesting plots and claiming Ether.
**/
contract ClaimFacet {

    event BeanClaim(address indexed account, uint32[] withdrawals, uint256 beans);
    event LPClaim(address indexed account, uint32[] withdrawals, uint256 lp);
    event TokenClaim(address indexed account, address token, uint32[] withdrawals, uint256 amount);
    event SingleTokenClaim(address indexed account, address token, uint32 withdrawal, uint256 amount);
    event BatchTokenClaim(address indexed account, address[] tokens, uint32[] withdrawals, uint256[] amounts);
    event EtherClaim(address indexed account, uint256 ethereum);
    event Harvest(address indexed account, uint256[] plots, uint256 beans);

    using SafeMath for uint256;
    using SafeMath for uint32;

    AppStorage internal s;

    function claim(LibClaim.Claim calldata c) public payable returns (uint256 beansClaimed) {
        beansClaimed = LibClaim.claim(c);

        LibCheck.balanceCheck();
    }

    function simpleClaim(address[] calldata tokens, uint32[] calldata withdrawals) external {
        LibClaim.simpleClaim(msg.sender, tokens, withdrawals);
    }

    function singleSimpleClaim(address token, uint32 _s) external {
        uint256 amount = LibClaim.singleSimpleClaim(msg.sender, token, _s);
        IERC20(token).transfer(msg.sender, amount);
        emit SingleTokenClaim(msg.sender, token, _s, amount);
    }

    function singleAdvancedClaim(LibClaim.AdvancedClaim calldata ac, bool toWallet) public {
        uint256 beansClaimed = LibClaim.singleAdvancedClaim(msg.sender, ac, toWallet);
        if (beansClaimed > 0) {
            if (toWallet) IBean(s.c.bean).transfer(msg.sender, beansClaimed);
            else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(beansClaimed);
        }
    }

    function advancedClaim(LibClaim.AdvancedClaim[] calldata acs, bool toWallet) public {
        uint256 beansClaimed = LibClaim.advancedClaim(msg.sender, acs, toWallet);
        if (beansClaimed > 0) {
            if (toWallet) IBean(s.c.bean).transfer(msg.sender, beansClaimed);
            else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(beansClaimed);
        }
    }


    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////

    function claimAndUnwrapBeans(LibClaim.Claim calldata c, uint256 amount) public payable returns (uint256 beansClaimed) {
        beansClaimed = LibClaim.claim(c);
        beansClaimed = beansClaimed.add(unwrapBeans(amount));

        LibCheck.balanceCheck();
    }

    function claimLegacyBeans(uint32[] calldata withdrawals) public {
        uint256 beansClaimed = LibClaim.claimBeans(withdrawals);
        IBean(s.c.bean).transfer(msg.sender, beansClaimed);
        LibCheck.beanBalanceCheck();
    }

    function claimLegacyLP(uint32[] calldata withdrawals) public {
        uint256 lpClaimed = LibClaim.claimLP(withdrawals);
        IUniswapV2Pair(s.c.pair).transfer(msg.sender, lpClaimed);
    }

    // function removeAndClaimLP(
    //     uint32[] calldata withdrawals,
    //     uint256 minBeanAmount,
    //     uint256 minEthAmount
    // )
    //     public
    // {
    //     LibClaim.removeAndClaimLP(withdrawals, minBeanAmount, minEthAmount);
    //     LibCheck.balanceCheck();
    // }

    function harvest(uint256[] calldata plots) public {
        uint256 beansHarvested = LibClaim.harvest(plots);
        IBean(s.c.bean).transfer(msg.sender, beansHarvested);
        LibCheck.beanBalanceCheck();
    }

    function claimEth() public {
        LibClaim.claimEth();
    }

    function unwrapBeans(uint amount) public returns (uint256 beansToWallet) {
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

    function wrapBeans(uint amount) public {
        IBean(s.c.bean).transferFrom(msg.sender, address(this), amount);
        s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(amount);

    }

    function wrappedBeans(address user) public view returns (uint256) {
        return s.a[user].wrappedBeans;
    }
}
