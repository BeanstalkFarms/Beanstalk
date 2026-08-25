/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {UnripeSettings} from "contracts/beanstalk/storage/System.sol";

/**
 * @title InitProtectedUnderlying
 * @notice Moves Unripe LP backing from Beanstalk custody into protected BCM custody without
 * changing the total backing attributed to Unripe LP holders.
 */
contract InitProtectedUnderlying {
    using SafeERC20 for IERC20;

    AppStorage internal s;

    event ProtectUnderlying(address indexed recipient, uint256 underlying);

    function init(address recipient, uint256 amount) external {
        require(recipient != address(0), "Init: Protected recipient is zero");
        require(amount > 0, "Init: Protected amount is zero");

        address urLp = s.sys.tokens.urLp;
        UnripeSettings storage settings = s.sys.silo.unripeSettings[urLp];
        require(
            settings.balanceOfUnderlying >= amount,
            "Init: Insufficient local underlying"
        );
        require(
            settings.protectedUnderlyingCustodian == address(0) ||
                settings.protectedUnderlyingCustodian == recipient,
            "Init: Protected custodian mismatch"
        );

        settings.protectedUnderlyingCustodian = recipient;
        settings.balanceOfUnderlying -= amount;
        settings.protectedUnderlying += amount;

        IERC20(settings.underlyingToken).safeTransfer(recipient, amount);

        emit ProtectUnderlying(recipient, amount);
    }
}
