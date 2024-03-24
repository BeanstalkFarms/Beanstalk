/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import "./Strings.sol";

import {Utils} from "test/foundry/utils/Utils.sol";

// Diamond setup
import {Diamond} from "contracts/beanstalk/Diamond.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {MockInitDiamond} from "contracts/mocks/newMockInitDiamond.sol";
import {InitDiamond} from "contracts/mocks/newInitDiamond.sol";

/// Modules
// Diamond
import {DiamondCutFacet} from "contracts/beanstalk/diamond/DiamondCutFacet.sol";
import {DiamondLoupeFacet} from "contracts/beanstalk/diamond/DiamondLoupeFacet.sol";
import {PauseFacet} from "contracts/beanstalk/diamond/PauseFacet.sol";
import {OwnershipFacet} from "contracts/beanstalk/diamond/OwnershipFacet.sol";

// Silo
import {MockSiloFacet, SiloFacet} from "contracts/mocks/mockFacets/MockSiloFacet.sol";
import {BDVFacet} from "contracts/beanstalk/silo/BDVFacet.sol";
import {GaugePointFacet} from "contracts/beanstalk/sun/GaugePointFacet.sol";
import {LiquidityWeightFacet} from "contracts/beanstalk/sun/LiquidityWeightFacet.sol";
import {WhitelistFacet} from "contracts/beanstalk/silo/WhitelistFacet/WhitelistFacet.sol";

// Field
import {MockFieldFacet, FieldFacet} from "contracts/mocks/mockFacets/MockFieldFacet.sol";
import {FundraiserFacet} from "contracts/beanstalk/field/FundraiserFacet.sol";
import {MockFundraiserFacet} from "contracts/mocks/mockFacets/MockFundraiserFacet.sol";

// Farm
import {FarmFacet} from "contracts/beanstalk/farm/FarmFacet.sol";
import {CurveFacet} from "contracts/beanstalk/farm/CurveFacet.sol";
import {TokenFacet} from "contracts/beanstalk/farm/TokenFacet.sol";

/// Misc
import {MockAdminFacet} from "contracts/mocks/mockFacets/MockAdminFacet.sol";
import {MockWhitelistFacet, WhitelistFacet} from "contracts/mocks/mockFacets/MockWhitelistFacet.sol";
import {UnripeFacet, MockUnripeFacet} from "contracts/mocks/mockFacets/MockUnripeFacet.sol";
import {MockFertilizerFacet, FertilizerFacet} from "contracts/mocks/mockFacets/MockFertilizerFacet.sol";
import {MockSeasonFacet, SeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {MockConvertFacet, ConvertFacet} from "contracts/mocks/mockFacets/MockConvertFacet.sol";

/// Ecosystem
import {BeanstalkPrice} from "contracts/ecosystem/price/BeanstalkPrice.sol";

/// Mocks
import {MockToken} from "contracts/mocks/MockToken.sol";
import {Mock3Curve} from "contracts/mocks/curve/Mock3Curve.sol";
import {MockCurveFactory} from "contracts/mocks/curve/MockCurveFactory.sol";
import {MockCurveZap} from "contracts/mocks/curve/MockCurveZap.sol";
import {MockMeta3Curve} from "contracts/mocks/curve/MockMeta3Curve.sol";
import {MockUniswapV3Pool} from "contracts/mocks/uniswap/MockUniswapV3Pool.sol";
import {MockUniswapV3Factory} from "contracts/mocks/uniswap/MockUniswapV3Factory.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";

// Potential removals for L2 migration.
import {MockMarketplaceFacet, MarketplaceFacet} from "contracts/mocks/mockFacets/MockMarketplaceFacet.sol";


import "contracts/beanstalk/AppStorage.sol";
import "contracts/libraries/Decimal.sol";
import "contracts/libraries/LibSafeMath32.sol";
import "contracts/libraries/Token/LibTransfer.sol";

import "contracts/C.sol";

/**
 * @title TestHelper
 * @author Brean
 * @notice Test helper contract for Beanstalk tests.
 */
abstract contract TestHelper is Test {
    
    Utils internal utils;
  
    address payable[] internal users;

    address internal deployer;

    // beanstalk
    address payable constant BEANSTALK  = payable(address(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5));

    /**
     * @notice deploys the beanstalk diamond contract.
     * @param mock if true, deploys all mocks and sets the diamond address to the canonical beanstalk address.
     */
    function setupDiamond(bool mock) public returns (Diamond d) {
        // create accounts
        utils = new Utils();
        users = utils.createUsers(6);
        deployer = users[0];

        vm.label(deployer, "Deployer");

        // create facet cuts
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](50);

        // add or remove facets here. Facets here do not have mocks.
        uint i;
        cut[i++] = _cut("BDVFacet", address(new BDVFacet()));
        cut[i++] = _cut("CurveFacet", address(new CurveFacet()));
        cut[i++] = _cut("FarmFacet", address(new FarmFacet()));
        cut[i++] = _cut("PauseFacet", address(new PauseFacet()));
        cut[i++] = _cut("OwnershipFacet", address(new OwnershipFacet()));
        cut[i++] = _cut("TokenFacet", address(new TokenFacet()));
        cut[i++] = _cut("GaugePointFacet", address(new GaugePointFacet()));
        cut[i++] = _cut("LiquidityWeightFacet", address(new LiquidityWeightFacet()));

        // facets with a mock counterpart should be added here.
        if(mock) {
            cut[i++] = _cut("MockAdminFacet", address(new MockAdminFacet()));
            cut[i++] = _cut("MockConvertFacet", address(new MockConvertFacet()));
            cut[i++] = _cut("MockFertilizerFacet", address(new MockFertilizerFacet()));
            cut[i++] = _cut("MockFieldFacet", address(new MockFieldFacet()));
            cut[i++] = _cut("MockFundraiserFacet", address(new MockFundraiserFacet()));
            cut[i++] = _cut("MockMarketplaceFacet", address(new MockMarketplaceFacet()));
            cut[i++] = _cut("MockSeasonFacet", address(new MockSeasonFacet()));
            cut[i++] = _cut("MockSiloFacet", address(new MockSiloFacet()));
            cut[i++] = _cut("MockUnripeFacet", address(new MockUnripeFacet()));
            cut[i++] = _cut("MockWhitelistFacet", payable(address(new MockWhitelistFacet())));
        } else {
            cut[i++] = _cut("ConvertFacet", address(new ConvertFacet()));
            cut[i++] = _cut("FertilizerFacet", address(new FertilizerFacet()));
            cut[i++] = _cut("FieldFacet", address(new FieldFacet()));
            cut[i++] = _cut("FundraiserFacet", address(new FundraiserFacet()));
            cut[i++] = _cut("MarketplaceFacet", address(new MarketplaceFacet()));
            cut[i++] = _cut("SeasonFacet", address(new SeasonFacet()));
            cut[i++] = _cut("SiloFacet", address(new SiloFacet()));
            cut[i++] = _cut("UnripeFacet", address(new UnripeFacet()));
            cut[i++] = _cut("WhitelistFacet", address(new WhitelistFacet()));
        }

        assembly {
            mstore(cut, i)
        }

        d = deployDiamondAtAddress(deployer, BEANSTALK);
        console.log("Deployed facets.");
        deployMockTokens();
        // create diamond    
        // d = new Diamond(deployer);
        console.log("jack");

        // if mocking, set the diamond address to
        // the canonical beanstalk address.
        address initDiamondAddress;
        if(mock) { 
            console.log("jack");
            initDiamondAddress = address(new MockInitDiamond());
            console.log("jack");
        } else {
            initDiamondAddress = address(new InitDiamond());
        }

        vm.prank(deployer);
        console.log("here");
        IDiamondCut(address(d)).diamondCut(
            cut,
            initDiamondAddress,
            abi.encodeWithSignature("init()")
        );
        console.log("there");
        console.log("jack");

        console.log("Initialized diamond at", address(d));
    }

    /**
     * @notice deploys mock tokens.
     */
    function deployMockTokens() public {
        // impersonate tokens and utilities
        _mockToken("Bean", address(C.bean()));
        MockToken(address(C.bean())).setDecimals(6);
        _mockToken("USDC", address(C.usdc()));
        _mockPrice();
        _mockCurve(); // only if "reset"
        // _mockUniswap();
        _mockUnripe();
        _mockWeth(); // only if "reset"
        // _mockCurveMetapool();
        // _mockFertilizer();
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

    /**
     * @notice deploys a diamond contract at an address.
     */
    function deployDiamondAtAddress(address _deployer, address payable beanstalkAddress) internal returns (Diamond d) {
        vm.prank(_deployer);
        deployCodeTo("Diamond.sol", abi.encode(_deployer), beanstalkAddress);
        return Diamond(beanstalkAddress);
    }

    function _etch(string memory _file, address _address, bytes memory args) internal returns (address) {
        address codeaddress = deployCode(_file, args);
        vm.etch(_address, getBytecodeAt(codeaddress));
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
        p = new BeanstalkPrice(BEANSTALK);
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
        stableFactory.set_coins(C.CURVE_BEAN_METAPOOL, [
            C.BEAN,
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
            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, //weth
            address(C.usdc()),//usdc
            3000
            );
        bytes memory code = getBytecodeAt(ethUsdc);
        // address targetAddr = C.UNIV3_ETH_USDC_POOL;
        // vm.etch(targetAddr, code);
        // MockUniswapV3Pool(C.UNIV3_ETH_USDC_POOL).setOraclePrice(1000e6,18);
    }

    function _mockCurveMetapool() internal {
        address THREE_CRV = address(C.threeCrv());
        MockMeta3Curve p = MockMeta3Curve(_etch("MockMeta3Curve.sol", C.CURVE_BEAN_METAPOOL, abi.encode("")));
        p.init(C.BEAN, THREE_CRV, C.curve3PoolAddress());
        p.set_A_precise(1000);
        p.set_virtual_price(1 wei);
    }

    function _mockUnripe() internal {
        MockToken urbean = _mockToken("Unripe BEAN", C.UNRIPE_BEAN);
        urbean.setDecimals(6);
        _mockToken("Unripe BEAN:3CRV", C.UNRIPE_LP);
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

    // gets bytecode at specific address (cant use address.code as we're in 0.7.6)
    function getBytecodeAt(address _addr) public view returns (bytes memory o_code) {
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
            extcodecopy(_addr, add(o_code, 0x20), 0, size)
        }
    }

    // /// @dev deploy `n` mock ERC20 tokens and sort by address
    // function deployMockTokens(uint n) internal {
    //     IERC20[] memory _tokens = new IERC20[](n);
    //     for (uint i = 0; i < n; i++) {
    //         IERC20 temp = IERC20(
    //             new MockToken(
    //                 string.concgetBytecodeAt("Token ", i.toString()), // name
    //                 string.concgetBytecodeAt("TOKEN", i.toString()), // symbol
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

    /// @dev impersonate `from`
    modifier prank(address from) {
        vm.startPrank(from);
        _;
        vm.stopPrank();
    }
}
