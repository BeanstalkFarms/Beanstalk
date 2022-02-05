/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibCheck.sol";
import "./LibInternal.sol";
import "./LibMarket.sol";
import "./LibAppStorage.sol";
import "../interfaces/IWETH.sol";
import "../C.sol";

/**
 * @author Publius
 * @title Claim Library handles claiming Bean and LP withdrawals, harvesting plots and claiming Ether.
**/
library LibClaim {

    using SafeMath for uint256;
    using SafeMath for uint32;

    event BeanClaim(address indexed account, uint32[] withdrawals, uint256 beans);
    event LPClaim(address indexed account, uint32[] withdrawals, uint256 lp);
    event TokenClaim(address indexed account, address token, uint32[] withdrawals, uint256 amount);
    event BatchTokenClaim(address indexed account, address[] tokens, uint32[] withdrawals, uint256[] amounts);
    event EtherClaim(address indexed account, uint256 ethereum);
    event Harvest(address indexed account, uint256[] plots, uint256 beans);

    struct AdvancedClaim {
        address token;
        uint32[] withdrawals;
        uint8 claimType;
        uint256[] settings;
    }

    struct Claim {
        address[] tokens;
        uint32[] withdrawals;
        AdvancedClaim[] cp;
        bool claimEth;
        bool toWallet;
    }

    function claim(Claim calldata c) public returns (uint256 beansClaimed) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        simpleClaim(msg.sender, c.tokens, c.withdrawals);
        beansClaimed = advancedClaim(msg.sender, c.cp, c.toWallet);
        if (c.claimEth) claimEth();

        if (beansClaimed > 0) {
            if (c.toWallet) IBean(C.beanAddress()).transfer(msg.sender, beansClaimed);
            else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(beansClaimed);
        }
    }

    function simpleClaim(address account, address[] calldata tokens, uint32[] calldata withdrawals) public {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256[] memory amounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            amounts[i] = singleSimpleClaim(account, tokens[i], withdrawals[i]);
        }
        emit BatchTokenClaim(account, tokens, withdrawals, amounts);
    }

    function singleSimpleClaim(address account, address token, uint32 _s) public returns (uint256 amount) {
        amount = removeTokenWithdrawal(account, token, _s);
        IERC20(token).transfer(account, amount);
    }

    function advancedClaim(address account, AdvancedClaim[] calldata acs, bool toWallet) public returns (uint256 beansClaimed) {
        for (uint256 i = 0; i < acs.length; i++) {
            uint256 bc = singleAdvancedClaim(account, acs[i], toWallet);
            if (bc > 0) beansClaimed = beansClaimed.add(bc);
        }
    }

    function singleAdvancedClaim(address account, AdvancedClaim calldata ac, bool toWallet) public returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 amount;
        if (ac.claimType == 0) {
            amount = singleMultiClaim(account, ac.token, ac.withdrawals);
            if (!toWallet && ac.token == C.beanAddress()) return amount;
        }
        else if (ac.token == C.beanAddress()) {
            // Legacy Claim
            if (ac.claimType == 1) return claimBeans(ac.withdrawals);
            // Harvest
            else if (ac.claimType == 2) return harvest(ac.settings);
            revert("Claim: Invalid type.");
        }
        else if (ac.token == s.c.pair) {
            // Legacy Claim
            if (ac.claimType == 1) {
                amount = claimLP(ac.withdrawals);
            }
            // Claim and Remove
            else if (ac.claimType < 4) {
                // 2 Normal
                // 3 Legacy
                // 4 Normal
                // 5 Legacy
                return removeAndClaimLP(
                    account,
                    ac.withdrawals, 
                    toWallet, 
                    ac.claimType == 3,
                    ac.settings[0],
                    ac.settings[1]
                );
            } else {
                revert("Claim: Invalid type.");
            }
        }
        IERC20(ac.token).transfer(account, amount);
        return 0;
    }

    function singleMultiClaim(address account, address token, uint32[] calldata withdrawals) private returns (uint256 tokenClaimed) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        for(uint256 i = 0; i < withdrawals.length; i++) {
            require(withdrawals[i] <= s.season.current, "Claim: Withdrawal not receivable.");
            tokenClaimed = tokenClaimed.add(removeTokenWithdrawal(msg.sender, token, withdrawals[i]));
        }
        emit TokenClaim(msg.sender, token, withdrawals, tokenClaimed);
        return tokenClaimed;
    }

    function removeTokenWithdrawal(address account, address token, uint32 _s) private returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 amount = s.a[account].withdrawals[IERC20(token)][_s];
        require(amount > 0, "Claim: LP withdrawal is empty.");
        delete s.a[account].withdrawals[IERC20(token)][_s];
        s.siloBalances[IERC20(token)].withdrawn = s.siloBalances[IERC20(token)].withdrawn.sub(amount);
        return amount;
    }
    
    // Claim Beans

    function claimBeans(uint32[] calldata withdrawals) public returns (uint256 beansClaimed) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        for (uint256 i = 0; i < withdrawals.length; i++) {
            require(withdrawals[i] <= s.season.current, "Claim: Withdrawal not recievable.");
            beansClaimed = beansClaimed.add(claimBeanWithdrawal(msg.sender, withdrawals[i]));
        }
        emit BeanClaim(msg.sender, withdrawals, beansClaimed);
    }

    function claimBeanWithdrawal(address account, uint32 _s) private returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 amount = s.a[account].bean.withdrawals[_s];
        
        require(amount > 0, "Claim: Bean withdrawal is empty.");
        delete s.a[account].bean.withdrawals[_s];
        s.siloBalances[C.beanERC20()].withdrawn = s.siloBalances[C.beanERC20()].withdrawn.sub(amount);
        return amount;
    }

    // Claim LP

    function removeAndClaimLP(
        address account,
        uint32[] calldata withdrawals,
        bool toWallet,
        bool legacy,
        uint256 minBeanAmount,
        uint256 minEthAmount
    )
        public
        returns (uint256 beans)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 lp;
        if (legacy) lp = claimLP(withdrawals);
        else lp = singleMultiClaim(account, s.c.pair, withdrawals);
        if (toWallet) LibMarket.removeLiquidity(lp, minBeanAmount, minEthAmount);
        else (beans,) = LibMarket.removeLiquidityWithBeanAllocation(lp, minBeanAmount, minEthAmount);
    }

    function claimLP(uint32[] calldata withdrawals) public returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 lpClaimd = 0;
        for(uint256 i = 0; i < withdrawals.length; i++) {
            require(withdrawals[i] <= s.season.current, "Claim: Withdrawal not recievable.");
            lpClaimd = lpClaimd.add(claimLPWithdrawal(msg.sender, withdrawals[i]));
        }
        emit LPClaim(msg.sender, withdrawals, lpClaimd);
        return lpClaimd;
    }

    function claimLPWithdrawal(address account, uint32 _s) private returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 amount = s.a[account].lp.withdrawals[_s];
        require(amount > 0, "Claim: LP withdrawal is empty.");
        delete s.a[account].lp.withdrawals[_s];
        s.siloBalances[IERC20(s.c.pair)].withdrawn = s.siloBalances[IERC20(s.c.pair)].withdrawn.sub(amount);
        return amount;
    }

    // Season of Plenty

    function claimEth() public {
        LibInternal.updateSilo(msg.sender);
        uint256 eth = claimPlenty(msg.sender);
        emit EtherClaim(msg.sender, eth);
    }

    function claimPlenty(address account) private returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
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

    function harvest(uint256[] calldata plots) public returns (uint256 beansHarvested) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        for (uint256 i = 0; i < plots.length; i++) {
            require(plots[i] < s.f.harvestable, "Claim: Plot not harvestable.");
            require(s.a[msg.sender].field.plots[plots[i]] > 0, "Claim: Plot not harvestable.");
            uint256 harvested = harvestPlot(msg.sender, plots[i]);
            beansHarvested = beansHarvested.add(harvested);
        }
        require(s.f.harvestable.sub(s.f.harvested) >= beansHarvested, "Claim: Not enough Harvestable.");
        s.f.harvested = s.f.harvested.add(beansHarvested);
        emit Harvest(msg.sender, plots, beansHarvested);
    }

    function harvestPlot(address account, uint256 plotId) private returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 pods = s.a[account].field.plots[plotId];
        require(pods > 0, "Claim: Plot is empty.");
        uint256 harvestablePods = s.f.harvestable.sub(plotId);
        delete s.a[account].field.plots[plotId];
        if (harvestablePods >= pods) return pods;
        s.a[account].field.plots[plotId.add(harvestablePods)] = pods.sub(harvestablePods);
        return harvestablePods;
    }

}
