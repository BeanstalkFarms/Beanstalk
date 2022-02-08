/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/balancer/IVault.sol";
import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";
import "./LibAppStorage.sol";
import "./LibClaim.sol";

/**
 * @author Publius
 * @title Balancer Library handles swapping, adding and removing LP on Balancer for Beanstalk.
**/
library LibBalancer {
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

    function _addBalancerBSSLiquidity (uint256 beanAmount, 
        uint256 stalkAmount, 
        uint256 seedAmount,
        bytes32 poolId,
        address recipient,
        IVault.JoinPoolRequest memory request
    ) 
        internal
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
            maxAmountsIn, abi.encodePacked([beanAmount, stalkAmount, seedAmount],[0, 0, 0]), false
        );

        uint256 bptAmountOut;

        IVault(s.balancerVault).joinPool(
            poolId, 
            msg.sender, 
            recipient, 
            request
        );
    }
}