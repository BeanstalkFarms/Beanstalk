// /*
//  SPDX-License-Identifier: MIT
// */

// pragma experimental ABIEncoderV2;
// pragma solidity =0.7.6;

// contract StateFacet {

//     AppStorage internal s;

//     function appStorage() external return (AppStorageLite memory) {
//         AppStorageLite memory ap;
//         ap.index = s.index;
//         ap.cases = s.cases;
//         ap.paused = s.paused
//         ap.season = s.season;
//         ap.c = s.c;
//         ap.f = s.f;
//         ap.g = s.g;
//         ap.o = s.o;
//         ap.r = s.r;
//         ap.s = s.s;
//         ap.reentrantStatus = s.reentrantStatus;
//         ap.w = s.w;
//         ap.bean = s.bean;
//         ap.lp = s.lp;
//         ap.si = s.si;
//         ap.sop = s.sop;
//         ap.v1SI = s.v1SI;
//         ap.unclaimedRoots = s.unclaimedRoots;
//         ap.v2SIBeans = s.v2SIBeans;
//         ap.bip0Start = s.bip0Start;
//         ap.hotFix3Start = s.hotFix3Start;
//         ap.fundraiserIndex = s.fundraiserIndex;
//         ap.refundStatus = s.refundStatus;
//         ap.beanRefundAmount = s.beanRefundAmount;
//         ap.ethRefundAmount = s.ethRefundAmount;
//     }

//     struct AppStorageLite {
//         uint8 index;
//         int8[32] cases;
//         bool paused;
//         uint128 pausedAt;
//         Storage.Season season;
//         Storage.Contracts c;
//         Storage.Field f;
//         Storage.Governance g;
//         Storage.Oracle o;
//         Storage.Rain r;
//         Storage.Silo s;
//         uint256 reentrantStatus; // An intra-transaction state variable to protect against reentrance
//         Storage.Weather w;
//         Storage.AssetSilo bean;
//         Storage.AssetSilo lp;
//         Storage.IncreaseSilo si;
//         Storage.SeasonOfPlenty sop;
//         Storage.V1IncreaseSilo v1SI;
//         uint256 unclaimedRoots;
//         uint256 v2SIBeans;
//         uint32 bip0Start;
//         uint32 hotFix3Start;
//         uint32 fundraiserIndex;
//         uint256 refundStatus;
//         uint256 beanRefundAmount;
//         uint256 ethRefundAmount;
//     }

// }
