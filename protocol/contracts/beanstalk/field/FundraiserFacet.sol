/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../ReentrancyGuard.sol";
import "~/libraries/LibDiamond.sol";
import "~/libraries/LibDibbler.sol";
import "~/libraries/Token/LibTransfer.sol";

/**
 * @title FieldFacet
 * @author Publius
 * @notice FieldFacet handles the creation, funding, and completion of a fundraiser.
 */
contract FundraiserFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /**
     * @notice Emitted when a fundraiser is created.
     *
     * @param id fundraiser number.
     * @param fundraiser The address that is allocated the total `token` raised. 
     * @param token the address of the `ask` token. 
     * @param amount the amount of `token` that is being raised
     */
    event CreateFundraiser(
        uint32 indexed id,
        address fundraiser,
        address token,
        uint256 amount
    );
    /**
     * @notice Emitted when a farmer calls {fund}.
     *
     * @param account address that is funding the fundraiser.
     * @param id the fundraiser id
     * @param amount the amount of `token` that `account` funded.
     */
    event FundFundraiser(
        address indexed account,
        uint32 indexed id,
        uint256 amount
    );

    /**
     * @notice Emitted upon the completion of a fundraiser
     *
     * @param id the fundraiser id
     */
    event CompleteFundraiser(uint32 indexed id);

    //////////////////////// FUND ////////////////////////

    /** 
     * @notice if a fundraiser is active, transfers `token` to beanstalk
     * and issues pods for the farmer.
     * if the farmer funds the remaining amount, the fundraiser is completed.
     * @param id fundraiser id.
     * @param amount the interest rate beanstalk is willing to issue pods.
     * @param mode balance to pull tokens from. See {LibTransfer-From}.
     * @return uint256 pods issued.
     */
    function fund(
        uint32 id,
        uint256 amount,
        LibTransfer.From mode
    ) external payable nonReentrant returns (uint256) {
        uint256 remaining = s.fundraisers[id].remaining;
        require(remaining > 0, "Fundraiser: already completed.");
        if (amount > remaining) amount = remaining;
        amount = LibTransfer.receiveToken(
            IERC20(s.fundraisers[id].token),
            amount,
            msg.sender,
            mode
        );
        s.fundraisers[id].remaining = remaining - amount; // Note: SafeMath is redundant here.
        emit FundFundraiser(msg.sender, id, amount);
        if (s.fundraisers[id].remaining == 0) completeFundraiser(id);
        C.bean().burn(amount);

        return LibDibbler.sowNoSoil(amount, msg.sender);
    }

    /** 
     * @notice completes the fundraiser, meaning no more pods 
     * can be issued for `token`. The funds raised is transfered to 
     * the payee.
     * @param id fundraiser id.
     */
    function completeFundraiser(uint32 id) internal {
        require(
            block.timestamp != s.fundraisers[id].start,
            "Fundraiser: start block"
        );
        IERC20(s.fundraisers[id].token).safeTransfer(
            s.fundraisers[id].payee,
            s.fundraisers[id].total
        );
        emit CompleteFundraiser(id);
    }


    /** 
     * @notice creates a fundraiser.

     * @param payee the address to transfer the raised funds to. 
     * @param token the token to raise.
     * @param amount the quanity of `token` that can be raised.
     *
     * @dev beans are minted here as no pods can be minted without burning beans.
     * in a fundraiser, 1 `token` = 1 bean sown for pods, irregardless of price.
     */
    function createFundraiser(
        address payee,
        address token,
        uint256 amount
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        uint32 id = s.fundraiserIndex;
        s.fundraisers[id].token = token;
        s.fundraisers[id].remaining = amount;
        s.fundraisers[id].total = amount;
        s.fundraisers[id].payee = payee;
        s.fundraisers[id].start = block.timestamp;
        s.fundraiserIndex = id + 1;
        C.bean().mint(address(this), amount);
        emit CreateFundraiser(id, payee, token, amount);
    }

    //////////////////////// GETTERS ////////////////////////

    /**
    * @notice Returns remaining `token` that can be raised
    * for a given fundrasier id.
    */
    function remainingFunding(uint32 id) public view returns (uint256) {
        return s.fundraisers[id].remaining;
    }

    /**
    * @notice Returns the total amount of `token` that can be raised.
    */
    function totalFunding(uint32 id) public view returns (uint256) {
        return s.fundraisers[id].total;
    }

    /**
    * @notice Returns the token address of the token being raised.
    */
    function fundingToken(uint32 id) public view returns (address) {
        return s.fundraisers[id].token;
    }

    /**
    * @notice Returns the payee, token, total, remaining, 
    * and start of a fundraiser
    */
    function fundraiser(uint32 id)
        public
        view
        returns (Storage.Fundraiser memory)
    {
        return s.fundraisers[id];
    }

    /**
    * @notice Returns the total numnber of fundraisers 
    * that beanstalk has created.
    */
    function numberOfFundraisers() public view returns (uint32) {
        return s.fundraiserIndex;
    }
}
