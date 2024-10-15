/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "contracts/beanstalk/barn/UnripeFacet.sol";
import "contracts/libraries/LibAppStorage.sol";
import "contracts/libraries/LibTractor.sol";

/**
 * @author Publius
 * @title Mock Unripe Facet
 **/
contract MockUnripeFacet is UnripeFacet {
    using SafeERC20 for IERC20;
    using LibRedundantMath256 for uint256;

    function addUnderlying(address unripeToken, uint256 amount) external payable nonReentrant {
        address underlyingToken = s.sys.silo.unripeSettings[unripeToken].underlyingToken;
        IERC20(underlyingToken).safeTransferFrom(LibTractor._user(), address(this), amount);
        s.sys.silo.unripeSettings[unripeToken].balanceOfUnderlying = s
            .sys
            .silo
            .unripeSettings[unripeToken]
            .balanceOfUnderlying
            .add(amount);
    }

    function addUnderlyingWithRecap(
        address unripeToken,
        uint256 amount
    ) external payable nonReentrant {
        address underlyingToken = s.sys.silo.unripeSettings[unripeToken].underlyingToken;
        IERC20(underlyingToken).safeTransferFrom(LibTractor._user(), address(this), amount);
        LibUnripe.addUnderlying(unripeToken, amount);
    }

    function resetUnderlying(address unripeToken) external {
        s.sys.silo.unripeSettings[unripeToken].balanceOfUnderlying = 0;
    }

    function getLegacyLockedUnderlyingBean() public view returns (uint256) {
        return
            LibLockedUnderlying.getLockedUnderlying(
                s.sys.tokens.urBean,
                LibUnripe.getRecapPaidPercentAmount(1e6)
            );
    }

    function getLegacyLockedUnderlyingLP() public view returns (uint256) {
        return
            LibLockedUnderlying.getLockedUnderlying(
                s.sys.tokens.urLp,
                LibUnripe.getRecapPaidPercentAmount(1e6)
            );
    }
}
