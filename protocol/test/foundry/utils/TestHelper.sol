/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity =0.7.6;
pragma abicoder v2;


import "forge-std/console.sol";
import "forge-std/Test.sol";

import {Utils} from "test/foundry/utils/Utils.sol";

// Diamond setup
import {Diamond} from "~/beanstalk/Diamond.sol";
import {IDiamondCut} from "~/interfaces/IDiamondCut.sol";
import {MockInitDiamond} from "~/mocks/MockInitDiamond.sol";

/// Modules
// Diamond
import {DiamondCutFacet} from "~/beanstalk/diamond/DiamondCutFacet.sol";
import {DiamondLoupeFacet} from "~/beanstalk/diamond/DiamondLoupeFacet.sol";
import {PauseFacet} from "~/beanstalk/diamond/PauseFacet.sol";
import {OwnershipFacet} from "~/beanstalk/diamond/OwnershipFacet.sol";

// Silo
import {MockSiloFacet} from "~/mocks/mockFacets/MockSiloFacet.sol";
import {BDVFacet} from "~/beanstalk/silo/BDVFacet.sol";
import {ConvertFacet} from "~/beanstalk/silo/ConvertFacet.sol";
import {WhitelistFacet} from "~/beanstalk/silo/WhitelistFacet.sol";

// Field
import {MockFieldFacet} from "~/mocks/mockFacets/MockFieldFacet.sol";
import {MockFundraiserFacet} from "~/mocks/mockFacets/MockFundraiserFacet.sol";

// Farm
import {FarmFacet} from "~/beanstalk/farm/FarmFacet.sol";
import {CurveFacet} from "~/beanstalk/farm/CurveFacet.sol";
import {TokenFacet} from "~/beanstalk/farm/TokenFacet.sol";

/// Ecosystem
import {BeanstalkPrice} from "~/ecosystem/price/BeanstalkPrice.sol";

/// Mocks
import {MockConvertFacet} from "~/mocks/mockFacets/MockConvertFacet.sol";
import {MockMarketplaceFacet} from "~/mocks/mockFacets/MockMarketplaceFacet.sol";
import {MockSeasonFacet} from "~/mocks/mockFacets/MockSeasonFacet.sol";
import {MockFertilizerFacet} from "~/mocks/mockFacets/MockFertilizerFacet.sol";
import {MockToken} from "~/mocks/MockToken.sol";
import {MockUnripeFacet} from "~/mocks/mockFacets/MockUnripeFacet.sol";
import {Mock3Curve} from "~/mocks/curve/Mock3Curve.sol";
import {MockUniswapV3Pool} from "~/mocks/uniswap/MockUniswapV3Pool.sol";
import {MockUniswapV3Factory} from "~/mocks/uniswap/MockUniswapV3Factory.sol";
import {MockCurveFactory} from "~/mocks/curve/MockCurveFactory.sol";
import {MockCurveZap} from "~/mocks/curve/MockCurveZap.sol";
import {MockMeta3Curve} from "~/mocks/curve/MockMeta3Curve.sol";
import {MockWETH} from "~/mocks/MockWETH.sol";

import "~/beanstalk/AppStorage.sol";
import "~/libraries/Decimal.sol";
import "~/libraries/LibSafeMath32.sol";
import "~/libraries/Token/LibTransfer.sol";

import "~/C.sol";

abstract contract TestHelper is Test {
    Utils internal utils;
  
    address payable[] internal users;

    // the cool dudes
    address internal deployer;
    address internal publius;
    address internal brean;
    address internal siloChad;
    address internal alice;
    address internal bob;
    address internal diamond;


    // season mocks
    MockSeasonFacet internal season;
    MockSiloFacet internal silo;
    MockFieldFacet internal field;
    MockConvertFacet internal convert;
    MockFundraiserFacet internal fundraiser;
    MockMarketplaceFacet internal marketplace;
    MockFertilizerFacet internal fertilizer;
    TokenFacet internal token;

    function setupDiamond() public {
        diamond = address(deployMocks());
        season = MockSeasonFacet(diamond);
        silo = MockSiloFacet(diamond);
        field = MockFieldFacet(diamond);
        convert = MockConvertFacet(diamond);
        fundraiser = MockFundraiserFacet(diamond);
        marketplace = MockMarketplaceFacet(diamond);
        fertilizer = MockFertilizerFacet(diamond);
        token = TokenFacet(diamond);
    }

    function deployMocks() public returns (Diamond d) {
        // create accounts
        utils = new Utils();
        users = utils.createUsers(6);
        deployer = users[0];
        publius = users[1];
        brean = users[2];
        siloChad = users[3];
        alice = users[4];
        bob = users[5];

        vm.label(deployer, "Deployer");

        // create facet cuts
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](15);

        cut[0] = _cut("BDVFacet", address(new BDVFacet()));
        cut[1] = _cut("CurveFacet", address(new CurveFacet()));
        cut[2] = _cut("MockConvertFacet", address(new MockConvertFacet()));
        cut[3] = _cut("FarmFacet", address(new FarmFacet()));
        cut[4] = _cut("MockFieldFacet", address(new MockFieldFacet()));
        cut[5] = _cut("MockFundraiserFacet", address(new MockFundraiserFacet()));
        cut[6] = _cut("PauseFacet", address(new PauseFacet()));
        cut[7] = _cut("MockSeasonFacet", address(new MockSeasonFacet()));
        cut[8] = _cut("MockSiloFacet", address(new MockSiloFacet()));
        cut[9] = _cut("MockFertilizerFacet", address(new MockFertilizerFacet()));
        cut[10] = _cut("OwnershipFacet", address(new OwnershipFacet()));
        cut[11] = _cut("TokenFacet", address(new TokenFacet()));
        cut[12] = _cut("MockUnripeFacet", address(new MockUnripeFacet()));
        cut[13] = _cut("WhitelistFacet", address(new WhitelistFacet()));
        cut[14] = _cut("MockMarketplaceFacet", address(new MockMarketplaceFacet()));
        console.log("Deployed mock facets.");
        deployMockTokens();
        // create diamond    
        d = new Diamond(deployer);
        MockInitDiamond i = new MockInitDiamond();

        vm.prank(deployer);
        IDiamondCut(address(d)).diamondCut(
        cut,
        address(i), // address of contract with init() function
        abi.encodeWithSignature("init()")
        );

        console.log("Initialized diamond at", address(d));
    }

    function deployMockTokens() public {
        //impersonate tokens and utilities
        _mockToken("Bean", address(C.bean()));
        MockToken(address(C.bean())).setDecimals(6);
        _mockToken("USDC", address(C.usdc()));
        _mockPrice();
        _mockCurve(); // only if "reset"
        _mockUniswap();
        _mockUnripe();
        _mockWeth(); // only if "reset"
        //_mockCurveMetapool();
        //_mockFertilizer();
    }

    ///////////////////////// Utilities /////////////////////////

    function _abs(int256 v) pure internal returns (uint256) {
        return uint256(v < 0 ? 0 : v);
    }

    function _reset(uint256 _snapId) internal returns (uint256) {
        vm.revertTo(_snapId);
        return vm.snapshot();
    }

    //////////////////////// Deploy  /////////////////////////


    function _etch(string memory _file, address _address, bytes memory args) internal returns (address) {
        address codeaddress = deployCode(_file, args);
        vm.etch(_address, at(codeaddress));
        return _address;
    }

    function _mockToken(string memory _tokenName, address _tokenAddress) internal returns (MockToken) {
        return MockToken(_etch("MockToken.sol", _tokenAddress,abi.encode(_tokenName,"")));
    }

    function _mockWeth() internal returns (MockWETH) {
        address payable weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        return MockWETH(payable(_etch("MockWETH.sol", weth, abi.encode("Wrapped Ether","WETH"))));
    }

    function _mockPrice() internal returns (BeanstalkPrice p) {
        address PRICE_DEPLOYER = 0x884B463E078Ff26C4b83792dB9bEF33619a69767;
        vm.prank(PRICE_DEPLOYER);
        p = new BeanstalkPrice();
    }

    function _mockCurve() internal {
        address THREE_CRV = address(C.threeCrv());

        MockToken crv3 = _mockToken("3CRV", THREE_CRV);
        MockToken(crv3).setDecimals(18);
        //
        Mock3Curve pool3 = Mock3Curve(_etch("Mock3Curve.sol", C.curve3PoolAddress(), abi.encode(""))); // 3Curve = 3Pool
        Mock3Curve(pool3).set_virtual_price(1);

        //
        address STABLE_FACTORY = 0xB9fC157394Af804a3578134A6585C0dc9cc990d4;
        MockCurveFactory stableFactory = MockCurveFactory(_etch("MockCurveFactory.sol", STABLE_FACTORY, abi.encode("")));


        // address CRYPTO_REGISTRY = 0x8F942C20D02bEfc377D41445793068908E2250D0;
        address CURVE_REGISTRY = 0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5;
        _etch("MockToken.sol", CURVE_REGISTRY, abi.encode("")); // why this interface?
        stableFactory.set_coins(C.curveMetapoolAddress(), [
            C.beanAddress(),
            THREE_CRV,
            address(0),
            address(0)
        ]);
        //
        MockCurveZap curveZap = MockCurveZap(_etch("MockCurveZap.sol", C.curveZapAddress(), abi.encode("")));
        curveZap.approve();
    }

    function _mockUniswap() internal {
        //address UNIV3_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984; 
        MockUniswapV3Factory uniFactory = MockUniswapV3Factory(new MockUniswapV3Factory());
        address ethUsdc = 
            uniFactory.createPool(
            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,//weth
            address(C.usdc()),//usdc
            3000
            );
        bytes memory code = at(ethUsdc);
        address targetAddr = C.UniV3EthUsdc();
        vm.etch(targetAddr, code);
        MockUniswapV3Pool(C.UniV3EthUsdc()).setOraclePrice(1000e6,18);
    }

    function _mockCurveMetapool() internal {
        address THREE_CRV = address(C.threeCrv());
        MockMeta3Curve p = MockMeta3Curve(_etch("MockMeta3Curve.sol", C.curveMetapoolAddress(), abi.encode("")));
        p.init(C.beanAddress(), THREE_CRV, C.curve3PoolAddress());
        p.set_A_precise(1000);
        p.set_virtual_price(1 wei);
    }

    function _mockUnripe() internal {
        MockToken urbean = _mockToken("Unripe BEAN", C.unripeBeanAddress());
        urbean.setDecimals(6);
        _mockToken("Unripe BEAN:3CRV", C.unripeLPAddress());
    }

    function _printAddresses() internal view {
        console.log("C: Bean = %s", address(C.bean()));
    }

    function _cut(string memory _facetName, address _facetAddress)
        internal
        returns (IDiamondCut.FacetCut memory cut) 
    {
        bytes4[] memory functionSelectors = _generateSelectors(_facetName);
        cut = IDiamondCut.FacetCut({
            facetAddress: _facetAddress,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });
    }

    function _generateSelectors(string memory _facetName)
        internal
        returns (bytes4[] memory selectors)
    {
        string[] memory cmd = new string[](3);
        cmd[0] = "node";
        cmd[1] = "scripts/genSelectors.js";
        cmd[2] = _facetName;
        bytes memory res = vm.ffi(cmd);
        selectors = abi.decode(res, (bytes4[]));
    }

    //gets bytecode at specific address (cant use address.code as we're in 0.7.6)
    function at(address _addr) public view returns (bytes memory o_code) {
        assembly {
            // retrieve the size of the code
            let size := extcodesize(_addr)
            // allocate output byte array
            // by using o_code = new bytes(size)
            o_code := mload(0x40)
            // new "memory end" including padding
            mstore(0x40, add(o_code, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            // store length in memory
            mstore(o_code, size)
            // actually retrieve the code, this needs assembly
            extcodecopy(_addr, add(o_code, 0x20), 0, size)
        }
    }



    // function initUser() internal {
    //     users = new Users();
    //     address[] memory _user = new address[](2);
    //     _user = users.createUsers(2);
    //     user = _user[0];
    //     user2 = _user[1];
    // }

    // /// @dev deploy `n` mock ERC20 tokens and sort by address
    // function deployMockTokens(uint n) internal {
    //     IERC20[] memory _tokens = new IERC20[](n);
    //     for (uint i = 0; i < n; i++) {
    //         IERC20 temp = IERC20(
    //             new MockToken(
    //                 string.concat("Token ", i.toString()), // name
    //                 string.concat("TOKEN", i.toString()), // symbol
    //                 18 // decimals
    //             )
    //         );
    //         // Insertion sort
    //         uint j;
    //         if (i > 0) {
    //             for (j = i; j >= 1 && temp < _tokens[j - 1]; j--)
    //                 _tokens[j] = _tokens[j - 1];
    //             _tokens[j] = temp;
    //         } else _tokens[0] = temp;
    //     }
    //     for (uint i = 0; i < n; i++) tokens.push(_tokens[i]);
    // }

    // /// @dev mint mock tokens to each recipient
    // function mintTokens(address recipient, uint amount) internal {
    //     for (uint i = 0; i < tokens.length; i++)
    //         MockToken(address(tokens[i])).mint(recipient, amount);
    // }

    // /// @dev approve `spender` to use `owner` tokens
    // function approveMaxTokens(address owner, address spender) prank(owner) internal {
    //     for (uint i = 0; i < tokens.length; i++)
    //         tokens[i].approve(spender, type(uint).max);
    // }

    // /// @dev add the same `amount` of liquidity for all underlying tokens
    // function addLiquidityEqualAmount(address from, uint amount) prank(from) internal {
    //     uint[] memory amounts = new uint[](tokens.length);
    //     for (uint i = 0; i < tokens.length; i++) amounts[i] = amount;
    //     well.addLiquidity(amounts, 0, from);
    // }

    // /// @dev gets the first `n` mock tokens
    // function getTokens(uint n)
    //     internal
    //     view
    //     returns (IERC20[] memory _tokens)
    // {
    //     _tokens = new IERC20[](n);
    //     for (uint i; i < n; ++i) {
    //         _tokens[i] = tokens[i];
    //     }
    // }

    // /// @dev get `account` balance of each token, lp token, total lp token supply
    // function getBalances(address account) internal view returns (Balances memory balances) {
    //     uint[] memory tokenBalances = new uint[](tokens.length);
    //     for (uint i = 0; i < tokenBalances.length; ++i) {
    //         tokenBalances[i] = tokens[i].balanceOf(account);
    //     }
    //     balances = Balances(
    //         tokenBalances,
    //         well.balanceOf(account),
    //         well.totalSupply()
    //     );
    // }

    /// @dev impersonate `from`
    modifier prank(address from) {
        vm.startPrank(from);
        _;
        vm.stopPrank();
    }
}
