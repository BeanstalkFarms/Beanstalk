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
 * @author Publius
 * @title Funding Facet
 **/
contract FundraiserFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event CreateFundraiser(
        uint32 indexed id,
        address fundraiser,
        address token,
        uint256 amount
    );
    event FundFundraiser(
        address indexed account,
        uint32 indexed id,
        uint256 amount
    );
    event CompleteFundraiser(uint32 indexed id);

    /**
     * Fundraise
     **/

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

        return LibDibbler.sowNoSoil(amount, amount, msg.sender);
    }

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

    /**
     * Getters
     **/

    function remainingFunding(uint32 id) public view returns (uint256) {
        return s.fundraisers[id].remaining;
    }

    function totalFunding(uint32 id) public view returns (uint256) {
        return s.fundraisers[id].total;
    }

    function fundingToken(uint32 id) public view returns (address) {
        return s.fundraisers[id].token;
    }

    function fundraiser(uint32 id)
        public
        view
        returns (Storage.Fundraiser memory)
    {
        return s.fundraisers[id];
    }

    function numberOfFundraisers() public view returns (uint32) {
        return s.fundraiserIndex;
    }
}
