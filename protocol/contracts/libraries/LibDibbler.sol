/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../C.sol";
import "../interfaces/IBean.sol";
import "./LibAppStorage.sol";
import "./LibSafeMath32.sol";
import "./LibSafeMath128.sol";
import "./LibPRBMath.sol";



/**
 * @author Publius, Brean
 * @title Dibbler
 **/
library LibDibbler {
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;

    uint256 private constant DECIMALS = 1e6;
    
    event Sow(
        address indexed account,
        uint256 index,
        uint256 beans,
        uint256 pods
    );

    /**
     * Shed
     **/

    function sow(uint256 amount, address account) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // the amount of soil changes as a function of the morning auction;
        // soil consumed increases as dutch auction passes
        uint128 peas = s.f.soil;
        if (s.season.abovePeg) {
            uint256 scaledSoil = amount.mulDiv(
                morningAuction().add(1e8), 
                1e8,
                LibPRBMath.Rounding.Up
                );
            /// @dev overflow can occur due to rounding up, 
            /// but only occurs when all remaining soil is sown.
            (, s.f.soil) = s.f.soil.trySub(uint128(scaledSoil)); 
        } else {
            // We can assume amount <= soil from getSowAmount when below peg
            s.f.soil = s.f.soil - uint128(amount); 
        }
        return sowNoSoil(amount,peas,account);

    }

    function sowNoSoil(uint256 amount,uint256 _maxPeas, address account)
        internal
        returns (uint256)
    {
        uint256 pods;
        AppStorage storage s = LibAppStorage.diamondStorage();
        if(s.season.abovePeg) {
            pods = beansToPodsAbovePeg(amount,_maxPeas);
        } else {
            pods = beansToPods(amount,s.w.yield);
        }
        sowPlot(account, amount, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();
        return pods;
    }

    /// @dev function returns the weather scaled down
    /// @notice based on the block delta
    // precision level 1e6, as soil has 1e6 precision (1% = 1e6)
    // the formula log2(A * BLOCK_ELAPSED_MAX + 1) is applied, where
    // A = 2;
    // MAX_BLOCK_ELAPSED = 25;
    
    function morningAuction() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 delta = block.number.sub(s.season.sunriseBlock);
        if (delta > 24) { // check most likely case first
            return uint256(s.w.yield).mul(DECIMALS);
        } else if (delta == 1) {
            return auctionMath(279415312704); 
        } else if (delta == 2) {
            return auctionMath(409336034395);
        } else if (delta == 3) {
            return auctionMath(494912626048); 
        } else if (delta == 4) {
            return auctionMath(558830625409);
        } else if (delta == 5) {
            return auctionMath(609868162219);
        } else if (delta == 6) {
            return auctionMath(652355825780);
        } else if (delta == 7) {
            return auctionMath(688751347100); 
        } else if (delta == 8) {
            return auctionMath(720584687295);
        } else if (delta == 9) {
            return auctionMath(748873234524);
        } else if (delta == 10) {
            return auctionMath(774327938752);
        } else if (delta == 11) {
            return auctionMath(797465225780); 
        } else if (delta == 12) {
            return auctionMath(818672068791);
        } else if (delta == 13) {
            return auctionMath(838245938114);
        } else if (delta == 14) {
            return auctionMath(856420437864);
        } else if (delta == 15) {
            return auctionMath(873382373802); 
        } else if (delta == 16) {
            return auctionMath(889283474924);
        } else if (delta == 17) {
            return auctionMath(904248660443);
        } else if (delta == 18) {
            return auctionMath(918382006208);
        } else if (delta == 19) {
            return auctionMath(931771138485);
        } else if (delta == 20) {
            return auctionMath(944490527707);
        } else if (delta == 21) {
            return auctionMath(956603996980);
        } else if (delta == 22) {
            return auctionMath(968166659804);
        } else if (delta == 23) {
            return auctionMath(979226436102);
        } else if (delta == 24) {
            return auctionMath(989825252096);
        } else {
            /// @dev should only occur when delta == 0 
            /// (i.e called in the same block as sunrise) 
            return DECIMALS; //minimium 1% yield
        }
    }

    /// @dev scales down temperature, minimum 1e6 (unless temperature is 0%)
    function auctionMath(uint256 a) private view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 _yield  = s.w.yield;
        if(_yield == 0) return 0; 
        return _yield.mulDiv(a,1e6).max(DECIMALS);
    }

    function beansToPodsAbovePeg(uint256 beans, uint256 maxPeas) 
        private 
        view
        returns (uint256) 
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if(s.f.soil == 0){ //all soil is sown, pods issued must equal peas.
            return maxPeas;
        } else {
            /// @dev We round up as Beanstalk would rather issue too much pods than not enough.
            return beans.add(
                beans.mulDiv(
                    morningAuction(),
                    1e8,
                    LibPRBMath.Rounding.Up
                    )
                );
        }
    }

    function beansToPods(uint256 beans, uint256 weather)
        private
        pure
        returns (uint256)
    {
        return beans.add(beans.mul(weather).div(100));
    }

    function sowPlot(
        address account,
        uint256 beans,
        uint256 pods
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].field.plots[s.f.pods] = pods;
        emit Sow(account, s.f.pods, beans, pods);
    }

    function saveSowTime() private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.f.soil > 1e6 || s.w.nextSowTime < type(uint32).max) return;
        s.w.nextSowTime = uint32(block.timestamp.sub(s.season.timestamp));
    }
}
