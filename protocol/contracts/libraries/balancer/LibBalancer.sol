/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/balancer/IVault.sol";
import "../../interfaces/IBean.sol";
import "../LibAppStorage.sol";
import "../LibClaim.sol";
import "./WeightedPoolUserData.sol";

/**
 * @author Publius
 * @title Balancer Library handles swapping, adding and removing LP on Balancer for Beanstalk.
**/
library LibBalancer {
    
    // Join and Exit Enums for UserData Request
    // In order to preserve backwards compatibility, make sure new join and exit kinds are added at the end of the enum.
    enum JoinKind { INIT, EXACT_TOKENS_IN_FOR_BPT_OUT, TOKEN_IN_FOR_EXACT_BPT_OUT, ALL_TOKENS_IN_FOR_EXACT_BPT_OUT }
    enum ExitKind {
        EXACT_BPT_IN_FOR_ONE_TOKEN_OUT,
        EXACT_BPT_IN_FOR_TOKENS_OUT,
        BPT_IN_FOR_EXACT_TOKENS_OUT,
        MANAGEMENT_FEE_TOKENS_OUT // for ManagedPool
    }

    struct AddBalancerLiquidity {
        uint256 beanAmount;
        uint256 stalkAmount;
        uint256 seedAmount;
    }

    // Balancer Request Struct
    struct JoinPoolRequest {
        IAsset[] assets;
        uint256[] maxAmountsIn;
        bytes userData;
        bool fromInternalBalance;
    }

    using SafeMath for uint256;

    // Balancer Internal functions
    function _buildBalancerPoolRequest(
        IAsset[] memory assets, 
        uint256[] memory maxAmountsIn, 
        bytes memory userData,
        bool fromInternalBalance
    ) 
        internal 
        returns (IVault.JoinPoolRequest memory request) 
    {
        request.assets = assets;
        request.maxAmountsIn = maxAmountsIn;
        request.userData = userData;
        request.fromInternalBalance = fromInternalBalance;
    }

    function _addBalancerBSSLiquidity (
        AddBalancerLiquidity memory al,
        bytes32 poolId,
        address recipient,
        IVault.JoinPoolRequest memory request
    ) 
        internal
        returns (uint256 lpAdded)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        IAsset[] memory assets;
        assets[0] = IAsset(s.c.bean);
        assets[1] = IAsset(address(this));
        assets[2] = IAsset(s.seedContract);

        uint256[] memory maxAmountsIn;
        maxAmountsIn[0] = 2**256 - 1;
        maxAmountsIn[1] = 2**256 - 1;
        maxAmountsIn[2] = 2**256 - 1;

        request = _buildBalancerPoolRequest(assets, 
            maxAmountsIn, abi.encodePacked([al.beanAmount, al.stalkAmount, al.seedAmount],[0, 0, 0]), false
        );

        lpAdded = IERC20(s.beanSeedStalk3Pair.poolAddress).balanceOf(address(this));

        IVault(s.balancerVault).joinPool(
            poolId, 
            msg.sender, 
            address(this), 
            request
        );

        lpAdded = IERC20(s.beanSeedStalk3Pair.poolAddress).balanceOf(address(this)).sub(lpAdded);
    }
}