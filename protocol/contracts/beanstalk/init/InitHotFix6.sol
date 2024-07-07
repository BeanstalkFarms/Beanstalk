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

    function init() external {
        // generated using the script at InitHotFix6_generate.js
        adjustAccount(address(0xa7e3fed558e81dab40cd87f334d68b0bf0ab3fd6), 1339045260000, 0x108288355466404f3e7a6);
        adjustAccount(address(0xe203096d7583e30888902b2608652c720d6c38da), 895630340000, 0xb0af280a27dd55e15186);
        adjustAccount(address(0xe5d36124de24481dac81cc06b2cd0bbe81701d14), 2719827460000, 0x2188cd396d713453f2385);
        adjustAccount(address(0xdff24806405f62637e0b44cc2903f1dfc7c111cd), 4465241140000, 0x370dfc5bf2d37e323068e);
        adjustAccount(address(0xcde68f6a7078f47ee664ccbc594c9026a8a72d25), 87310400000, 0x11395a60856002fd2bb2);
        adjustAccount(address(0x6343b307c288432bb9ad9003b4230b08b56b3b82), 1587607930000, 0x139316f233f39b2d7fc7a);
        adjustAccount(address(0xfe7a7f227967104299e2ed9c47ca28eadc3a7c5f), 800384040000, 0x9de506359f0bad67dd9b);
        adjustAccount(address(0xf6f6d531ed0f7fa18cae2c73b21aa853c765c4d8), 20368615360000, 0xfb2309014e60e822b7351);
        adjustAccount(address(0xcba1a275e2d858ecffaf7a87f606f74b719a8a93), 2488521800000, 0x1eaeb6b687d242423820f);
        adjustAccount(address(0xcfd9c9ac52b4b6fe30537803caeb327dadd411bb), 2265290610000, 0x1bee1ca2f7c590350cd56);
        adjustAccount(address(0x91953b70d0861309f7d3a429a1cf82c8353132be), 4742314480000, 0x3a7888a5bfb29eb0da262);
        adjustAccount(address(0x19831b174e9deabf9e4b355aadfd157f09e2af1f), 10904953700000, 0x867425f8ce119587b9de6);
        adjustAccount(address(0xe249d1be97f4a716cde0d7c5b6b682f491621c41), 2813491850000, 0x22b0711a97fac34a4ff80);
        adjustAccount(address(0x19c5bad4354e9a78a1ca0235af29b9eacf54ff2b), 815845330000, 0xa0f1d9d41775c1be9a18);
        adjustAccount(address(0x6cd83315e4c4bfdf95d4a8442927c018f328c9fe), 1737884960000, 0x156d6baf092d9ce69e24e);
        adjustAccount(address(0xf05b641229bb2aa63b205ad8b423a390f7ef05a7), 1636015800000, 0x142be2152769fa6a1e6a6);
        adjustAccount(address(0x7d50bfead43d4fdd47a8a61f32305b2de21068bd), 3004066550000, 0x2509d6ed94de16f5eac68);
        adjustAccount(address(0xd3e0ef0ebb7bc536405918d4d8dbdf981185d435), 50000000000000, 0x26878bc7521efacb1e9a15);
        adjustAccount(address(0xe146313a9d6d6ccdd733cc15af3cf11d47e96f25), 229584270000, 0x2d4a511d471dc4e8b28e);
        adjustAccount(address(0x4ca3e5bdf3823febbe18f9664cded14b7243971c), 421932770000, 0x533c2d45ba7bc6e67620);
        adjustAccount(address(0xf62405e188bb9629ed623d60b7c70dcc4e2abd81), 2113424040000, 0x1a0eac76731c01011962e);
        adjustAccount(address(0x52eaa3345a9b68d3b5d52da2fd47ebfc5ed11d4e), 1176225810000, 0xe808ff73ff408717ef32);
        adjustAccount(address(0xd441c97ef1458d847271f91714799007081494ef), 24242385640000, 0x12ae51564d62b1f98c00d5);
        adjustAccount(address(0xeaa4f3773f57af1d4c7130e07cde48050245511b), 43414340140000, 0x2174630740c9787fc077a2);
        adjustAccount(address(0x2bf046a052942b53ca6746de4d3295d8f10d4562), 2580594620000, 0x1fd1386c8296b8f435874);
        adjustAccount(address(0x7de837caff6a19898e507f644939939cb9341209), 6846927200000, 0x546b31ae800ccacbe5126);
        adjustAccount(address(0xc56725de9274e17847db0e45c1da36e46a7e197f), 4881455690000, 0x3c2f8212788e5a5158657);
        adjustAccount(address(0x0be9a9100a95075270e47de519d53c5fc8f7c936), 4913752530000, 0x3c95729e8e9795a27c2da);
        adjustAccount(address(0xc7c1b169a8d3c5f2d6b25642c4d10da94ffcd3c9), 3599776050000, 0x2c62191fde7981d7d1bef);
        adjustAccount(address(0xf840aa35b73ee0bbf488d81d684706729aba0a15), 142499790000, 0x1c1c6ebc7efe0c2b0949);
        adjustAccount(address(0x11b197e2c61c2959ae84bc7f9db8e3fefe511043), 7875550010000, 0x6119df38da1aef59eccdc);
        adjustAccount(address(0xda8c9d1b00d12ddf67f2aa6af582fd6a38209b39), 3764622150000, 0x2e6a685941d5cbb0d48ce);
        adjustAccount(address(0x53bd04892c7147e1126bc7ba68f2fb6bf5a43910), 41586641380000, 0x200bd5c36c99660fed5e56);
        adjustAccount(address(0x4bf44e0c856d096b755d54ca1e9cfdc0115ed2e6), 1269973450000, 0xfa876179d7c800e2c28a);
        adjustAccount(address(0x2972bf9b54ac5100d747150dfd684899c0abec5e), 35735731380000, 0x1b899ee086192386fc657e);

        // fix system-level deposited bean and bdv
        s.siloBalances[C.BEAN].deposited = s.siloBalances[C.BEAN].deposited - 29746746393;
        s.siloBalances[C.BEAN].depositedBdv = s.siloBalances[C.BEAN].depositedBdv - 29746746393;
    }

    function adjustAccount(address account, uint128 stalk, uint128 roots) internal {
        s.a[account].s.stalk = s.a[account].s.stalk - stalk;
        s.a[account].roots = s.a[account].roots - roots;
    }
}
