/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../../libraries/Silo/LibSilo.sol";
import "../../libraries/Silo/LibTokenSilo.sol";
import "../../libraries/LibSafeMath32.sol";
import "../../libraries/Convert/LibConvert.sol";
import "../../libraries/LibInternal.sol";
import "../../libraries/LibDelegate.sol";
import "../../libraries/LibTractor.sol";
import "../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
 **/
contract ConvertFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    bytes4 public constant CONVERT_FOR_SELECTOR =
        bytes4(
            keccak256(bytes("convertFor(address,bytes,uint32[],uint256[])"))
        );

    event Convert(
        address indexed account,
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount
    );

    event RemoveDeposits(
        address indexed account,
        address indexed token,
        uint32[] seasons,
        uint256[] amounts,
        uint256 amount
    );

    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 bdvRemoved;
    }

    struct ConvertResult {
        uint32 toSeason;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 fromBdv;
        uint256 toBdv;
    }

    function convert(
        bytes calldata convertData,
        uint32[] memory crates,
        uint256[] memory amounts
    ) external payable nonReentrant returns (ConvertResult memory result) {
        return _convert(msg.sender, convertData, crates, amounts);
    }

    function tractorConvert(
        bytes calldata convertData,
        uint32[] memory crates,
        uint256[] memory amounts
    ) external payable nonReentrant returns (ConvertResult memory result) {
        address publisher = LibTractor.getActivePublisher();

        return _convert(publisher, convertData, crates, amounts);
    }

    function convertFor(
        address account,
        bytes calldata convertData,
        uint32[] memory crates,
        uint256[] memory amounts
    ) external nonReentrant returns (ConvertResult memory result) {
        (
            bytes1 place,
            bytes1 approvalType,
            bytes memory approvalData
        ) = LibDelegate.getApprovalDetails(account, CONVERT_FOR_SELECTOR);

        // PRE-APPROVAL
        if (place == 0x00) {
            LibDelegate.checkApproval(
                account,
                CONVERT_FOR_SELECTOR,
                msg.sender,
                place,
                approvalType,
                approvalData,
                convertData,
                ""
            );
        }

        result = _convert(account, convertData, crates, amounts);

        // POST-APPROVAL
        if (place == 0x01) {
            LibDelegate.checkApproval(
                account,
                CONVERT_FOR_SELECTOR,
                msg.sender,
                place,
                approvalType,
                approvalData,
                convertData,
                abi.encode(
                    result.toSeason,
                    result.fromAmount,
                    result.toAmount,
                    result.fromBdv,
                    result.toBdv
                )
            );
        }
    }

    function _convert(
        address account,
        bytes calldata convertData,
        uint32[] memory crates,
        uint256[] memory amounts
    ) internal returns (ConvertResult memory result) {
        LibInternal.updateSilo(account);

        address toToken;
        address fromToken;
        uint256 grownStalk;
        uint32 toSeason;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 fromBdv;
        uint256 toBdv;
        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(
            convertData
        );

        (grownStalk, fromBdv) = _withdrawTokens(
            account,
            fromToken,
            crates,
            amounts,
            fromAmount
        );

        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);
        toBdv = newBdv > fromBdv ? newBdv : fromBdv;

        toSeason = _depositTokens(
            account,
            toToken,
            toAmount,
            toBdv,
            grownStalk
        );

        emit Convert(account, fromToken, toToken, fromAmount, toAmount);

        return ConvertResult(toSeason, fromAmount, toAmount, fromBdv, toBdv);
    }

    function _withdrawTokens(
        address account,
        address token,
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxTokens
    ) internal returns (uint256, uint256) {
        require(
            seasons.length == amounts.length,
            "Convert: seasons, amounts are diff lengths."
        );
        AssetsRemoved memory a;
        uint256 depositBDV;
        uint256 i = 0;
        while ((i < seasons.length) && (a.tokensRemoved < maxTokens)) {
            if (a.tokensRemoved.add(amounts[i]) < maxTokens)
                depositBDV = LibTokenSilo.removeDeposit(
                    account,
                    token,
                    seasons[i],
                    amounts[i]
                );
            else {
                amounts[i] = maxTokens.sub(a.tokensRemoved);
                depositBDV = LibTokenSilo.removeDeposit(
                    account,
                    token,
                    seasons[i],
                    amounts[i]
                );
            }
            a.tokensRemoved = a.tokensRemoved.add(amounts[i]);
            a.bdvRemoved = a.bdvRemoved.add(depositBDV);
            a.stalkRemoved = a.stalkRemoved.add(
                depositBDV.mul(s.season.current - seasons[i])
            );
            i++;
        }
        for (i; i < seasons.length; ++i) amounts[i] = 0;
        emit RemoveDeposits(account, token, seasons, amounts, a.tokensRemoved);

        require(
            a.tokensRemoved == maxTokens,
            "Convert: Not enough tokens removed."
        );
        a.stalkRemoved = a.stalkRemoved.mul(s.ss[token].seeds);
        LibTokenSilo.decrementDepositedToken(token, a.tokensRemoved);
        LibSilo.withdrawSiloAssets(
            account,
            a.bdvRemoved.mul(s.ss[token].seeds),
            a.stalkRemoved.add(a.bdvRemoved.mul(s.ss[token].stalk))
        );
        return (a.stalkRemoved, a.bdvRemoved);
    }

    function _depositTokens(
        address account,
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk
    ) internal returns (uint32 _s) {
        require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

        uint256 seeds = bdv.mul(LibTokenSilo.seeds(token));
        if (grownStalk > 0) {
            _s = uint32(grownStalk.div(seeds));
            uint32 __s = s.season.current;
            if (_s >= __s) _s = __s - 1;
            grownStalk = uint256(_s).mul(seeds);
            _s = __s - _s;
        } else _s = s.season.current;
        uint256 stalk = bdv.mul(LibTokenSilo.stalk(token)).add(grownStalk);
        LibSilo.depositSiloAssets(account, seeds, stalk);

        LibTokenSilo.incrementDepositedToken(token, amount);
        LibTokenSilo.addDeposit(account, token, _s, amount, bdv);
    }

    function getMaxAmountIn(address tokenIn, address tokenOut)
        external
        view
        returns (uint256 amountIn)
    {
        return LibConvert.getMaxAmountIn(tokenIn, tokenOut);
    }

    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        return LibConvert.getAmountOut(tokenIn, tokenOut, amountIn);
    }
}
