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

/**
 * @author Publius
 * @title Claim handles claiming Bean and LP withdrawals, harvesting plots and claiming Ether.
**/
contract ClaimFacet {

    using SafeMath for uint256;
    using SafeMath for uint32;

    AppStorage private s;

    event BeanClaim(address indexed account, uint32[] withdrawals, uint256 beans);
    event LPClaim(address indexed account, uint32[] withdrawals, uint256 lp);
    event EtherClaim(address indexed account, uint256 ethereum);
    event Harvest(address indexed account, uint256[] plots, uint256 beans);

    struct Claim {
        uint32[] beanWithdrawals;
        uint32[] lpWithdrawals;
        uint256[] plots;
        bool claimEth;
        bool convertLP;
        uint256 minBeanAmount;
        uint256 minEthAmount;
    }

    /**
     * Public
    **/

    function claim(Claim calldata c) public payable {
        if (c.beanWithdrawals.length > 0) _claimBeans(c.beanWithdrawals);
        if (c.lpWithdrawals.length > 0) {
            if (c.convertLP) _removeAndClaimLP(c.lpWithdrawals, c.minBeanAmount, c.minEthAmount);
            else _claimLP(c.lpWithdrawals);
        }
        if (c.plots.length > 0) _harvest(c.plots);
        if (c.claimEth) claimEth();
        if (msg.sender != address(this)) LibCheck.balanceCheck();
    }

    function claimBeans(uint32[] calldata withdrawals) public {
        _claimBeans(withdrawals);
        LibCheck.beanBalanceCheck();
    }

    function claimLP(uint32[] calldata withdrawals) public {
        _claimLP(withdrawals);
        LibCheck.lpBalanceCheck();
    }

    function removeAndClaimLP(
        uint32[] calldata withdrawals,
        uint256 minBeanAmount,
        uint256 minEthAmount
    )
        public
    {
        _removeAndClaimLP(withdrawals, minBeanAmount, minEthAmount);
        LibCheck.balanceCheck();
    }

    function harvest(uint256[] calldata plots) public {
        _harvest(plots);
        LibCheck.beanBalanceCheck();
    }

    function claimEth() public {
        LibInternal.updateSilo(msg.sender);
        uint256 eth = claimPlenty(msg.sender);
        emit EtherClaim(msg.sender, eth);
    }

    /**
     * Internal
    **/

    // Claim Beans

    function _claimBeans(uint32[] calldata withdrawals) private {
        uint256 beansClaimed = 0;
        for (uint256 i = 0; i < withdrawals.length; i++) {
            require(withdrawals[i] <= s.season.current, "Claim: Withdrawal not recievable.");
            beansClaimed = beansClaimed.add(claimBeanWithdrawal(msg.sender, withdrawals[i]));
        }
        IBean(s.c.bean).transfer(msg.sender, beansClaimed);
        emit BeanClaim(msg.sender, withdrawals, beansClaimed);
    }

    function claimBeanWithdrawal(address account, uint32 _s) private returns (uint256) {
        uint256 amount = s.a[account].bean.withdrawals[_s];
        require(amount > 0, "Claim: Bean withdrawal is empty.");
        delete s.a[account].bean.withdrawals[_s];
        s.bean.withdrawn = s.bean.withdrawn.sub(amount);
        return amount;
    }

    // Claim LP

    function _claimLP(uint32[] calldata withdrawals) private {
        uint256 lpClaimed = __claimLP(withdrawals);
        IUniswapV2Pair(s.c.pair).transfer(msg.sender, lpClaimed);
    }

    function _removeAndClaimLP(
        uint32[] calldata withdrawals,
        uint256 minBeanAmount,
        uint256 minEthAmount
    )
        private
    {
        uint256 lpClaimd = __claimLP(withdrawals);
        LibMarket.removeLiquidity(lpClaimd, minBeanAmount, minEthAmount);
    }

    function __claimLP(uint32[] calldata withdrawals) private returns (uint256) {
        uint256 lpClaimd = 0;
        for(uint256 i = 0; i < withdrawals.length; i++) {
            require(withdrawals[i] <= s.season.current, "Claim: Withdrawal not recievable.");
            lpClaimd = lpClaimd.add(claimLPWithdrawal(msg.sender, withdrawals[i]));
        }
        emit LPClaim(msg.sender, withdrawals, lpClaimd);
        return lpClaimd;
    }

    function claimLPWithdrawal(address account, uint32 _s) private returns (uint256) {
        uint256 amount = s.a[account].lp.withdrawals[_s];
        require(amount > 0, "Claim: LP withdrawal is empty.");
        delete s.a[account].lp.withdrawals[_s];
        s.lp.withdrawn = s.lp.withdrawn.sub(amount);
        return amount;
    }

    // Season of Plenty

    function claimPlenty(address account) private returns (uint256) {
        if (s.sop.base == 0) return 0;
        uint256 eth = s.a[account].sop.base.mul(s.sop.weth).div(s.sop.base);
        s.sop.weth = s.sop.weth.sub(eth);
        s.sop.base = s.sop.base.sub(s.a[account].sop.base);
        s.a[account].sop.base = 0;
        IWETH(s.c.weth).withdraw(eth);
        (bool success, ) = account.call{value: eth}("");
        require(success, "WETH: ETH transfer failed");
        return eth;
    }

    // Harvest

    function _harvest(uint256[] calldata plots) private {
        uint256 podsHarvested = 0;
        for(uint256 i = 0; i < plots.length; i++) {
            require(plots[i] < s.f.harvestable, "Claim: Plot not harvestable.");
            require(s.a[msg.sender].field.plots[plots[i]] > 0, "Claim: Plot not harvestable.");
            uint256 harvested = harvestPlot(msg.sender, plots[i]);
            podsHarvested = podsHarvested.add(harvested);
        }
        harvestToAccount(msg.sender, podsHarvested);
        emit Harvest(msg.sender, plots, podsHarvested);
    }

    function harvestPlot(address account, uint256 plotId) private returns (uint256) {
        uint256 pods = s.a[account].field.plots[plotId];
        require(pods > 0, "Claim: Plot is empty.");
        uint256 harvestablePods = s.f.harvestable.sub(plotId);
        delete s.a[account].field.plots[plotId];
        if (harvestablePods >= pods) return pods;
        s.a[account].field.plots[plotId.add(harvestablePods)] = pods.sub(harvestablePods);
        return harvestablePods;
    }

    function harvestToAccount(address account, uint256 amount) private {
        require(s.f.harvestable.sub(s.f.harvested) >= amount, "Claim: Not enough Harvestable.");
        IBean(s.c.bean).transfer(account, amount);
        s.f.harvested = s.f.harvested.add(amount);
    }

}
