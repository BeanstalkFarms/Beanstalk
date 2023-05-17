/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./SiloExit.sol";

/**
 * @title Silo
 * @author Publius
 * @notice Provides utility functions for claiming Silo rewards, including:
 *
 * - Grown Stalk (see "Mow")
 * - Earned Beans, Earned Stalk (see "Plant")
 * - 3CRV earned during a Flood (see "Flood")
 *
 * For backwards compatibility, a Flood is sometimes referred to by its old name
 * "Season of Plenty".
 */
 
contract Silo is SiloExit {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using LibSafeMath128 for uint128;

    //////////////////////// EVENTS ////////////////////////    

    /**
     * @notice Emitted when the deposit associated with the Earned Beans of
     * `account` are Planted.
     * @param account Owns the Earned Beans
     * @param beans The amount of Earned Beans claimed by `account`.
     */
    event Plant(
        address indexed account,
        uint256 beans
    );

    /**
     * @notice Emitted when 3CRV paid to `account` during a Flood is Claimed.
     * @param account Owns and receives the assets paid during a Flood.
     * @param plenty The amount of 3CRV claimed by `account`. This is the amount
     * that `account` has been paid since their last {ClaimPlenty}.
     * 
     * @dev Flood was previously called a "Season of Plenty". For backwards
     * compatibility, the event has not been changed. For more information on 
     * Flood, see: {FIXME(doc)}.
     */
    event ClaimPlenty(
        address indexed account,
        uint256 plenty
    );


    /**
     * @notice Emitted when `account` gains or loses Stalk.
     * @param account The account that gained or lost Stalk.
     * @param delta The change in Stalk.
     * @param deltaRoots The change in Roots. For more info on Roots, see: 
     * FIXME(doc)
     *   
     * @dev {StalkBalanceChanged} should be emitted anytime a Deposit is added, removed or transferred AND
     * anytime an account Mows Grown Stalk.
     * @dev BIP-24 included a one-time re-emission of {SeedsBalanceChanged} for accounts that had
     * executed a Deposit transfer between the Replant and BIP-24 execution. For more, see:
     * [BIP-24](https://github.com/BeanstalkFarms/Beanstalk-Governance-Proposals/blob/master/bip/bip-24-fungible-bdv-support.md)
     * [Event-24-Event-Emission](https://github.com/BeanstalkFarms/Event-24-Event-Emission)
     */
    event StalkBalanceChanged(
        address indexed account,
        int256 delta,
        int256 deltaRoots
    );

    //////////////////////// INTERNAL: MOW ////////////////////////

    /**
     * @dev Claims the Grown Stalk for `msg.sender`. Requires token address to mow.
     */
    modifier mowSender(address token) {
        LibSilo._mow(msg.sender, token);
        _;
    }

    //////////////////////// INTERNAL: PLANT ////////////////////////

    /**
     * @dev Plants the Plantable BDV of `account` associated with its Earned
     * Beans.
     * 
     * For more info on Planting, see: {SiloFacet-plant}
     */
     
    function _plant(address account, address token) internal returns (uint256 beans) {
        // Need to Mow for `account` before we calculate the balance of 
        // Earned Beans.
        
        // per the zero withdraw update, planting is handled differently 
        // depending whether or not the user plants during the vesting period of beanstalk. 
        // during the vesting period, the earned beans are not issued to the user.
        // thus, the roots calculated for a given user is different. 
        // This is handled by the super mow function, which stores the difference in roots.
        LibSilo._mow(account, token);
        uint256 accountStalk = s.a[account].s.stalk;

        // Calculate balance of Earned Beans.
        beans = _balanceOfEarnedBeans(account, accountStalk);
        s.a[account].deltaRoots = 0; // must be 0'd, as calling balanceOfEarnedBeans would give a invalid amount of beans. 
        if (beans == 0) return 0;
        
        // Reduce the Silo's supply of Earned Beans.
        // SafeCast unnecessary because beans is <= s.earnedBeans.
        s.earnedBeans = s.earnedBeans.sub(uint128(beans));
        
        // Deposit Earned Beans if there are any. Note that 1 Bean = 1 BDV.
        LibTokenSilo.addDepositToAccount(
            account,
            C.BEAN,
            LibTokenSilo.stemTipForToken(token),
            beans, // amount
            beans, // bdv
            LibTokenSilo.Transfer.emitTransferSingle
        );
        s.a[account].deltaRoots = 0; // must be 0'd, as calling balanceOfEarnedBeans would give a invalid amount of beans. 

        // Earned Stalk associated with Earned Beans generate more Earned Beans automatically (i.e., auto compounding).
        // Earned Stalk are minted when Earned Beans are minted during Sunrise. See {Sun.sol:rewardToSilo} for details.
        // Similarly, `account` does not receive additional Roots from Earned Stalk during a Plant.
        // The following lines allocate Earned Stalk that has already been minted to `account`.
        uint256 stalk = beans.mul(C.getStalkPerBean());
        s.a[account].s.stalk = accountStalk.add(stalk);


        emit StalkBalanceChanged(account, int256(stalk), 0);
        emit Plant(account, beans);
    }

    //////////////////////// INTERNAL: SEASON OF PLENTY ////////////////////////

    /**
     * @dev Gas optimization: An account can call `{SiloFacet:claimPlenty}` even
     * if `s.a[account].sop.plenty == 0`. This would emit a ClaimPlenty event
     * with an amount of 0.
     */
    function _claimPlenty(address account) internal {
        // Plenty is earned in the form of 3Crv.
        uint256 plenty = s.a[account].sop.plenty;
        C.threeCrv().safeTransfer(account, plenty);
        delete s.a[account].sop.plenty;

        emit ClaimPlenty(account, plenty);
    }


}
