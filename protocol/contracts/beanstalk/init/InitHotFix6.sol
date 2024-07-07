/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import {AppStorage} from "../AppStorage.sol";
import {C} from "../../C.sol";

contract InitHotFix6 {
    AppStorage internal s;
    using SafeMath for uint256;

    // copied from LibSilo.sol
    event StalkBalanceChanged(address indexed account, int256 delta, int256 deltaRoots);

    function init() external {
        // generated using the script at InitHotFix6_generate.js
        adjustAccount(address(0xA7e3feD558E81dAb40Cd87F334D68b0BF0AB3fD6), 1339045260000, 0x108288355466404f3e7a6);
        adjustAccount(address(0xE203096D7583E30888902b2608652c720D6C38da), 895630340000, 0xb0af280a27dd55e15186);
        adjustAccount(address(0xe5D36124DE24481daC81cc06b2Cd0bbE81701D14), 2719827460000, 0x2188cd396d713453f2385);
        adjustAccount(address(0xdff24806405f62637E0b44cc2903F1DfC7c111Cd), 4465241140000, 0x370dfc5bf2d37e323068e);
        adjustAccount(address(0xcDe68F6a7078f47Ee664cCBc594c9026a8a72d25), 87310400000, 0x11395a60856002fd2bb2);
        adjustAccount(address(0x6343B307C288432BB9AD9003B4230B08B56b3b82), 1587607930000, 0x139316f233f39b2d7fc7a);
        adjustAccount(address(0xFE7A7F227967104299E2ED9c47ca28eADc3a7C5f), 800384040000, 0x9de506359f0bad67dd9b);
        adjustAccount(address(0xF6f6d531ed0f7fa18cae2C73b21aa853c765c4d8), 20368615360000, 0xfb2309014e60e822b7351);
        adjustAccount(address(0xCba1A275e2D858EcffaF7a87F606f74B719a8A93), 2488521800000, 0x1eaeb6b687d242423820f);
        adjustAccount(address(0xcfd9c9Ac52b4B6Fe30537803CaEb327daDD411bB), 2265290610000, 0x1bee1ca2f7c590350cd56);
        adjustAccount(address(0x91953b70d0861309f7D3A429A1CF82C8353132Be), 4742314480000, 0x3a7888a5bfb29eb0da262);
        adjustAccount(address(0x19831b174e9deAbF9E4B355AadFD157F09E2af1F), 10904953700000, 0x867425f8ce119587b9de6);
        adjustAccount(address(0xe249d1bE97f4A716CDE0D7C5B6b682F491621C41), 2813491850000, 0x22b0711a97fac34a4ff80);
        adjustAccount(address(0x19c5baD4354e9a78A1CA0235Af29b9EAcF54fF2b), 815845330000, 0xa0f1d9d41775c1be9a18);
        adjustAccount(address(0x6CD83315e4c4bFdf95D4A8442927C018F328C9fe), 1737884960000, 0x156d6baf092d9ce69e24e);
        adjustAccount(address(0xf05b641229bB2aA63b205Ad8B423a390F7Ef05A7), 1636015800000, 0x142be2152769fa6a1e6a6);
        adjustAccount(address(0x7d50bfeAD43d4FDD47a8A61f32305b2dE21068Bd), 3004066550000, 0x2509d6ed94de16f5eac68);
        adjustAccount(address(0xd3e0Ef0eBB7bC536405918d4D8dBDF981185d435), 50000000000000, 0x26878bc7521efacb1e9a15);
        adjustAccount(address(0xE146313a9D6D6cCdd733CC15af3Cf11d47E96F25), 229584270000, 0x2d4a511d471dc4e8b28e);
        adjustAccount(address(0x4Ca3E5bDf3823fEBbE18F9664cdEd14b7243971C), 421932770000, 0x533c2d45ba7bc6e67620);
        adjustAccount(address(0xF62405e188Bb9629eD623d60B7c70dCc4e2ABd81), 2113424040000, 0x1a0eac76731c01011962e);
        adjustAccount(address(0x52EAa3345a9b68d3b5d52DA2fD47EbFc5ed11d4e), 1176225810000, 0xe808ff73ff408717ef32);
        adjustAccount(address(0xD441C97eF1458d847271f91714799007081494eF), 24242385640000, 0x12ae51564d62b1f98c00d5);
        adjustAccount(address(0xEAa4F3773F57af1D4c7130e07CDE48050245511B), 43414340140000, 0x2174630740c9787fc077a2);
        adjustAccount(address(0x2bF046A052942B53Ca6746de4D3295d8f10d4562), 2580594620000, 0x1fd1386c8296b8f435874);
        adjustAccount(address(0x7dE837cAff6A19898e507F644939939cB9341209), 6846927200000, 0x546b31ae800ccacbe5126);
        adjustAccount(address(0xC56725DE9274E17847db0E45c1DA36E46A7e197F), 4881455690000, 0x3c2f8212788e5a5158657);
        adjustAccount(address(0x0be9A9100A95075270e47De519D53c5fc8F7C936), 4913752530000, 0x3c95729e8e9795a27c2da);
        adjustAccount(address(0xC7C1b169a8d3c5F2D6b25642c4d10DA94fFCd3c9), 3599776050000, 0x2c62191fde7981d7d1bef);
        adjustAccount(address(0xF840AA35b73EE0Bbf488D81d684706729Aba0a15), 142499790000, 0x1c1c6ebc7efe0c2b0949);
        adjustAccount(address(0x11b197e2C61c2959Ae84bC7f9db8E3fEFe511043), 7875550010000, 0x6119df38da1aef59eccdc);
        adjustAccount(address(0xDa8C9D1B00D12DdF67F2aa6aF582fD6A38209b39), 3764622150000, 0x2e6a685941d5cbb0d48ce);
        adjustAccount(address(0x53BD04892c7147E1126bC7bA68f2fB6bF5A43910), 41586641380000, 0x200bd5c36c99660fed5e56);
        adjustAccount(address(0x4bf44E0c856d096B755D54CA1e9CFdc0115ED2e6), 1269973450000, 0xfa876179d7c800e2c28a);
        adjustAccount(address(0x2972bf9B54aC5100d747150Dfd684899c0aBEc5E), 35735731380000, 0x1b899ee086192386fc657e);

        // fix system-level deposited bean and bdv
        s.siloBalances[C.BEAN].deposited = s.siloBalances[C.BEAN].deposited - 29746746393;
        s.siloBalances[C.BEAN].depositedBdv = s.siloBalances[C.BEAN].depositedBdv - 29746746393;

        s.s.stalk = s.s.stalk - 297467463930000;
        s.s.roots = s.s.roots - 0xe539d6d0c64ac7c32eef9d;
    }

    function adjustAccount(address account, uint128 stalk, uint128 roots) internal {
        s.a[account].s.stalk = s.a[account].s.stalk - stalk;
        s.a[account].roots = s.a[account].roots - roots;

        // emit the event
        emit StalkBalanceChanged(account, -int256(stalk), -int256(roots));
    }
}
