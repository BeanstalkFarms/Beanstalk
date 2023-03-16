/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/C.sol";
import "~/libraries/Silo/LibSilo.sol";
import "~/libraries/Silo/LibTokenSilo.sol";
import "~/libraries/LibSafeMath32.sol";
import "~/libraries/Convert/LibConvert.sol";
import "~/libraries/LibInternal.sol";
import "../ReentrancyGuard.sol";
import "~/libraries/LibBytes.sol";


/**
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
 **/
contract ConvertFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibSafeMath32 for uint32;

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
        int96[] grownStalkPerBdvs,
        uint256[] amounts,
        uint256 amount,
        uint256[] bdvs
    );

    event TransferBatch(
        address indexed operator, 
        address indexed from, 
        address indexed to, 
        uint256[] ids, 
        uint256[] values
    );

    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 bdvRemoved;
    }

    function convert(
        bytes calldata convertData,
        int96[] memory grownStalkPerBdvs,
        uint256[] memory amounts
    )
        external
        payable
        nonReentrant
        returns (int96 toCumulativeGrownStalk, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv)
    {

        //a mow must be done before any convert, currently this happens in the guts of each convert
        //function. TODOSEEDS: pull out the parsing of convert data, find tokenIn, mow here, then pass
        //parsed data in to corresponding mow functions?

        address toToken; address fromToken; uint256 grownStalk;
        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(
            convertData
        );

        (grownStalk, fromBdv) = _withdrawTokens(
            fromToken,
            grownStalkPerBdvs,
            amounts,
            fromAmount
        );

        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);
        toBdv = newBdv > fromBdv ? newBdv : fromBdv;

        toCumulativeGrownStalk = _depositTokens(toToken, toAmount, toBdv, grownStalk);

        emit Convert(msg.sender, fromToken, toToken, fromAmount, toAmount);
    }

    function _withdrawTokens(
        address token,
        int96[] memory grownStalkPerBdvs,
        uint256[] memory amounts,
        uint256 maxTokens
    ) internal returns (uint256, uint256) {
        require(
            grownStalkPerBdvs.length == amounts.length,
            "Convert: grownStalkPerBdvs, amounts are diff lengths."
        );
        AssetsRemoved memory a;
        uint256 depositBDV;
        uint256 i = 0;
        {
        uint256[] memory bdvsRemoved = new uint256[](grownStalkPerBdvs.length);
        uint256[] memory depositIds = new uint256[](grownStalkPerBdvs.length);
        while ((i < grownStalkPerBdvs.length) && (a.tokensRemoved < maxTokens)) {
            if (a.tokensRemoved.add(amounts[i]) < maxTokens) {
                //keeping track of stalk removed must happen before we actually remove the deposit
                //this is because LibTokenSilo.grownStalkForDeposit() uses the current deposit info
                
                depositBDV = LibTokenSilo.removeDepositFromAccount(
                    msg.sender,
                    token,
                    grownStalkPerBdvs[i],
                    amounts[i]
                );
                bdvsRemoved[i] = depositBDV;
                a.stalkRemoved = a.stalkRemoved.add(
                    LibSilo.stalkReward(
                        grownStalkPerBdvs[i],
                        LibTokenSilo.cumulativeGrownStalkPerBdv(IERC20(token)),
                        depositBDV.toUint128()
                    )
                );
                
            } else {
                amounts[i] = maxTokens.sub(a.tokensRemoved);
                
                depositBDV = LibTokenSilo.removeDepositFromAccount(
                    msg.sender,
                    token,
                    grownStalkPerBdvs[i],
                    amounts[i]
                );
                
                bdvsRemoved[i] = depositBDV;
                a.stalkRemoved = a.stalkRemoved.add(
                    LibSilo.stalkReward(
                        grownStalkPerBdvs[i],
                        LibTokenSilo.cumulativeGrownStalkPerBdv(IERC20(token)),
                        depositBDV.toUint128()
                    )
                );
                
            }
            
            
            
            
            a.tokensRemoved = a.tokensRemoved.add(amounts[i]);
            a.bdvRemoved = a.bdvRemoved.add(depositBDV);
            
            
            depositIds[i] = uint256(LibBytes.packAddressAndCumulativeStalkPerBDV(
                token,
                grownStalkPerBdvs[i]
            ));
            i++;
        }
        for (i; i < grownStalkPerBdvs.length; ++i) amounts[i] = 0;
        


        

        
        
        emit RemoveDeposits(
            msg.sender,
            token,
            grownStalkPerBdvs,
            amounts,
            a.tokensRemoved,
            bdvsRemoved
        );
        // we emit 2 events for ERC1155 compatibility:
        // event 1: "Burn" ERC1155 deposit that was being converted from
        // event 2: "Mint" ERC1155 deposit being converted into: 
        // event 1 is emmitted here, the 2nd event is emitted in libtokensilo.addDepositToAccount
        emit TransferBatch(
            msg.sender, 
            msg.sender,
            address(0), 
            depositIds, 
            amounts
        );
        }

        require(
            a.tokensRemoved == maxTokens,
            "Convert: Not enough tokens removed."
        );
        LibTokenSilo.decrementTotalDeposited(token, a.tokensRemoved);
        
        // 
        LibSilo.burnStalk(
            msg.sender,
            a.stalkRemoved.add(a.bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv))
        );
        
        
        return (a.stalkRemoved, a.bdvRemoved);
    }

    function _depositTokens(
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk //stalk grown previously by this deposit
    ) internal returns (int96 _cumulativeGrownStalk) {
        require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

        
        

        //calculate cumulativeGrownStalk index we need to deposit at from grownStalk and bdv
        //if we attempt to deposit at a half-season (a grown stalk index that would fall between seasons)
        //then in affect we lose that partial season's worth of stalk when we deposit
        //so here we need to update grownStalk to be the amount you'd have with the above deposit
        
        /// @dev the two functions were combined into one function to save gas.
        // _cumulativeGrownStalk = LibTokenSilo.grownStalkAndBdvToCumulativeGrownStalk(IERC20(token), grownStalk, bdv);
        // grownStalk = uint256(LibTokenSilo.calculateStalkFromGrownStalkIndexAndBdv(IERC20(token), _cumulativeGrownStalk, bdv));
        // TODO: better name for this function
        (grownStalk, _cumulativeGrownStalk) = LibTokenSilo.calculateTotalGrownStalkandGrownStalk(IERC20(token), grownStalk, bdv);
        

        
        LibSilo.mintStalk(msg.sender, bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token)).add(grownStalk));

        LibTokenSilo.incrementTotalDeposited(token, amount);
        LibTokenSilo.addDepositToAccount(msg.sender, token, _cumulativeGrownStalk, amount, bdv);
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
