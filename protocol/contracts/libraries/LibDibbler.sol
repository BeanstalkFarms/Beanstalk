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
import { console } from "forge-std/console.sol";



/**
 * @author Publius
 * @title Dibbler
 **/
library LibDibbler {
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;

    uint256 private constant A = 2;
    uint256 private constant MAX_BLOCK_ELAPSED = 25;
    uint256 private constant DENOMINATOR = 5672425341971495578; //log2(A * BLOCK_ELAPSED_MAX + 1)
    uint256 private constant SCALE = 1e18;
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
        // We can assume amount <= soil from getSowAmount
        // the amount of soil changes as a function of the morning auction;
        // instead of updating soil, we scale down how much soil is used, and scale soil up in totalSoil function
        //uint256 _peas = peas();
        if (s.season.AbovePeg) {
            console.log("amt of soil used:", amount);
            console.log("amt of TrueSoil used:",uint128(
                    amount.mulDiv(
                        morningAuction().add(1e8),
                        101_000_000,
                        LibPRBMath.Rounding.Up
                        )
                    ));
            s.f.soil = s.f.soil -
                uint128(
                    amount.mulDiv(
                        morningAuction().add(1e8),
                        101_000_000,
                        LibPRBMath.Rounding.Up
                        )
                    );
        } else {
            s.f.soil = s.f.soil - uint128(amount);
        }
        
        //return sowNoSoil(amount,account,_peas);
        return sowNoSoil(amount,account);

    }

    //function sowNoSoil(uint256 amount, address account,uint256 peas)
    function sowNoSoil(uint256 amount, address account)
        internal
        returns (uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 pods = beansToPods(amount);
        sowPlot(account, amount, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();
        return pods;
    }

    function sowPlot(
        address account,
        uint256 beans,
        uint256 pods
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].field.plots[s.f.pods] = pods;
        console.log("pods issued is:", pods);
        emit Sow(account, s.f.pods, beans, pods);
    }


    function beansToPods(uint256 beans/*,uint256 peas*/) private returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        console.log("init peas:", s.f.peas);
        console.log("trueSoil after MaxSow:", s.f.soil);
        /// @dev ensures that maximum pods issued is never above peas, as we round pods up
        
        if(s.f.soil == 0){
            uint128 _peas = s.f.peas;
            s.f.peas = 0;
            return _peas;
        } else {
            uint256 _peas = 
                beans.add(beans.mulDiv(
                    morningAuction(),
                    1e8,
                    LibPRBMath.Rounding.Up
                    ));
            s.f.peas = s.f.peas - uint128(_peas); //Safemath Redundant since peas > _peas always
            return _peas;
        }
    }

    function saveSowTime() private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.f.soil > 1e6 || s.w.nextSowTime < type(uint32).max) return;
        s.w.nextSowTime = uint32(block.timestamp.sub(s.season.timestamp));
    }

    /// @dev function returns the weather scaled down based on the dutch auction
    // precision level 1e6, as soil has 1e6 precision (1% = 1e6)
    // FuTuRe oF FiNaNcE
    function morningAuction() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 delta = block.number.sub(s.season.sunriseBlock);
        if (delta > 24) { // check most likely case first
            return uint256(s.w.yield).mul(DECIMALS);
        } else if (delta == 1) {
            return AuctionMath(279415312704); 
        } else if (delta == 2) {
            return AuctionMath(409336034395);
        } else if (delta == 3) {
            return AuctionMath(494912626048); 
        } else if (delta == 4) {
            return AuctionMath(558830625409);
        } else if (delta == 5) {
            return AuctionMath(609868162219);
        } else if (delta == 6) {
            return AuctionMath(652355825780);
        } else if (delta == 7) {
            return AuctionMath(688751347100); 
        } else if (delta == 8) {
            return AuctionMath(720584687295);
        } else if (delta == 9) {
            return AuctionMath(748873234524);
        } else if (delta == 10) {
            return AuctionMath(774327938752);
        } else if (delta == 11) {
            return AuctionMath(797465225780); 
        } else if (delta == 12) {
            return AuctionMath(818672068791);
        } else if (delta == 13) {
            return AuctionMath(838245938114);
        } else if (delta == 14) {
            return AuctionMath(856420437864);
        } else if (delta == 15) {
            return AuctionMath(873382373802); 
        } else if (delta == 16) {
            return AuctionMath(889283474924);
        } else if (delta == 17) {
            return AuctionMath(904248660443);
        } else if (delta == 18) {
            return AuctionMath(918382006208);
        } else if (delta == 19) {
            return AuctionMath(931771138485);
        } else if (delta == 20) {
            return AuctionMath(944490527707);
        } else if (delta == 21) {
            return AuctionMath(956603996980);
        } else if (delta == 22) {
            return AuctionMath(968166659804);
        } else if (delta == 23) {
            return AuctionMath(979226436102);
        } else if (delta == 24) {
            return AuctionMath(989825252096);
        } else {
            return DECIMALS; //minimium 1% yield
        }
    }

    // helpers
    /// @dev takes in 1e12 number to multiply with yield, to get 1e6 scaled down weather
    function AuctionMath(uint256 a) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(s.w.yield).mulDiv(a,1e6).max(DECIMALS);
    }

    /// @dev peas are the potential pods that can be issued within a season.
    function peas() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.f.peas;
    }
}
