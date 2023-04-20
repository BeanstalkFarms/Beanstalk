import { ethers } from 'ethers';
import { Result } from 'ethers/lib/utils';
import { Beanstalk__factory, Curve3Pool__factory, CurveTriCrypto2Pool__factory, CurveRegistry__factory, CurveMetaFactory__factory, CurveCryptoFactory__factory, CurveMetaPool__factory, CurvePlainPool__factory, CurveZap__factory } from '~/generated';
import { getChainConstant } from '~/util/Chain';
import { BEANSTALK_ADDRESSES, BEAN_CRV3_ADDRESSES, CRYPTO_FACTORY_ADDRESSES, CURVE_ZAP_ADDRESSES, META_FACTORY_ADDRESSES, POOL3_ADDRESSES, POOL_REGISTRY_ADDRESSES, TRICRYPTO2_ADDRESSES } from '~/constants';
import { BEAN, USDT, WETH } from '~/constants/tokens';

function assert(condition : boolean, message?: string) : asserts condition is true {
  if (!condition) throw Error(message || 'Assertion failed');
}

export enum FarmFromMode {
  EXTERNAL = '0',
  INTERNAL = '1',
  INTERNAL_EXTERNAL = '2',
  INTERNAL_TOLERANT = '3',
}
export enum FarmToMode {
  EXTERNAL = '0',
  INTERNAL = '1',
}
export enum ClaimRewardsAction {
  MOW = '0',
  PLANT_AND_MOW = '1',
  ENROOT_AND_MOW = '2',
  CLAIM_ALL = '3',
}

export type ChainableFunctionResult = {
  name: string;
  amountOut: ethers.BigNumber;
  value?: ethers.BigNumber;
  data?: any;
  encode: (minAmountOut: ethers.BigNumber) => string;
  decode: (data: string) => Result;
};
export type ChainableFunction = (amountIn: ethers.BigNumber, forward?: boolean) => Promise<ChainableFunctionResult>;

/**
 * Estimation Design Notes (Silo Chad)
 * -----------------------------------
 * 
 * Forward calculation:
 * Start with an `amountIn`, walk through steps to get a final `amountOut`.
 * 
 * 1 ETH -> ? BEAN
 * amountInStep  |  amountOutStep  |  lookup function    |  params
 * -------------------------------------------------------------------------
 * 1 ETH            1 WETH            identity              
 * 1 WETH           1567.31 USDT      get_dy                i=2, j=0
 * 1567.31 USDT     1464.77 BEAN      get_dy_underlying     i=3, j=0     
 * -------------------------------------------------------------------------
 * amountOut = 1464.77 BEAN
 * 
 * Backward calcuation:
 * Start with a desired `amountOut`, walk backwards to figure out what I need to
 * input into each step to get the desired `amountOut`. We'll call this `maxAmountIn`
 * to use the crypto-native term.
 * 
 * Examples of where this is useful:
 *  - I want to buy Pods from a Pod Listing. It's going to cost me 1,000 Beans but I only have ETH.
 *    How much ETH should I input to buy 1,000 Beans?
 *  - I want to Sow; there is 100 Soil available (so I can only Sow 100 Beans). How much ETH should I swap
 *    to BEAN to Sow all 100 Soil?
 * 
 * ? ETH <- 1000 BEAN
 * amountInStep  |  amountOutStep  |  lookup function    |  params
 * -------------------------------------------------------------------------
 * 1000 BEAN        1068.44 USDT      get_dy_underlying     i=0, j=3
 * 1068.44 USDT     0.674 WETH        get_dy                i=0, j=2
 * 0.674 WETH       0.674 ETH         identity                
 * -------------------------------------------------------------------------
 */

const getContracts = (provider: ethers.providers.BaseProvider) => {
  // Addressses
  const chainId         = provider.network.chainId;
  const BEANSTALK       = getChainConstant(BEANSTALK_ADDRESSES, chainId);
  const POOL3           = getChainConstant(POOL3_ADDRESSES, chainId);
  const TRICRYPTO2      = getChainConstant(TRICRYPTO2_ADDRESSES, chainId);
  const BEANCRV3        = getChainConstant(BEAN_CRV3_ADDRESSES, chainId);
  const POOL_REGISTRY   = getChainConstant(POOL_REGISTRY_ADDRESSES, chainId);
  const META_FACTORY    = getChainConstant(META_FACTORY_ADDRESSES, chainId);
  const CRYPTO_FACTORY  = getChainConstant(CRYPTO_FACTORY_ADDRESSES, chainId);
  const ZAP             = getChainConstant(CURVE_ZAP_ADDRESSES, chainId);

  // Instances
  const pool3           = Curve3Pool__factory.connect(POOL3, provider);
  const tricrypto2      = CurveTriCrypto2Pool__factory.connect(TRICRYPTO2, provider);
  const beanCrv3        = CurveMetaPool__factory.connect(BEANCRV3, provider);
  const poolRegistry    = CurveRegistry__factory.connect(POOL_REGISTRY, provider);
  const metaFactory     = CurveMetaFactory__factory.connect(META_FACTORY, provider);
  const cryptoFactory   = CurveCryptoFactory__factory.connect(CRYPTO_FACTORY, provider);
  const zap             = CurveZap__factory.connect(ZAP, provider);

  console.debug('[Farm] Connected to addresses: ', {
    BEANSTALK,
    POOL3,
    TRICRYPTO2,
    BEANCRV3,
    POOL_REGISTRY,
    META_FACTORY,
    CRYPTO_FACTORY,
    ZAP,
  });

  return {
    beanstalk: Beanstalk__factory.connect(BEANSTALK, provider),
    curve: {
      // Pools
      pools: {
        pool3,
        [POOL3]: pool3,
        tricrypto2,
        [TRICRYPTO2]: tricrypto2,
        beanCrv3,
        [BEANCRV3]: beanCrv3
      },
      // Registries
      registries: {
        poolRegistry,
        [POOL_REGISTRY]: poolRegistry,
        metaFactory,
        [META_FACTORY]: metaFactory,
        cryptoFactory,
        [CRYPTO_FACTORY]: cryptoFactory,
      },
      zap,
    }
  };
};

export default class Farm {
  provider : ethers.providers.BaseProvider;

  contracts : ReturnType<typeof getContracts>;

  static SLIPPAGE_PRECISION = 10 ** 6;

  // ------------------------------------------

  constructor(_provider: ethers.providers.BaseProvider) {
    this.provider  = _provider;
    this.contracts = getContracts(_provider);
  }

  // ------------------------------------------

  static slip(
    _amount: ethers.BigNumber,
    _slippage: number
  ) {
    return (
      _amount
        .mul(Math.floor(Farm.SLIPPAGE_PRECISION * (1 - _slippage)))
        .div(Farm.SLIPPAGE_PRECISION)
    );
  }

  static direction<X1 extends any, X2 extends any>(
    _x1:      X1,
    _x2:      X2,
    _forward: boolean
  ) {
    return _forward ? [_x1, _x2] : [_x2, _x1];
  }

  /**
   * Executes a sequence of contract calls to estimate the `amountOut` received of some token
   * after an arbitrary set of chained transactions.
   * @param _fns array of chainable functions. Each accepts an `amountIn` and provides an `amountOut`.
   * @param _args[0] amount of the token to begin the sequence with
   * @param _forward whether to estimate forward or backward
   * @returns struct containing the final `amountOut` and aggregated steps
   */
  static async estimate(
    _fns: ChainableFunction[],
    _args: [amountIn: ethers.BigNumber],
    _forward: boolean = true,
  ) : Promise<{
    amountOut: ethers.BigNumber;
    value: ethers.BigNumber;
    steps: ChainableFunctionResult[];
  }> {
    let nextAmountIn = _args[0];
    let value = ethers.BigNumber.from(0);
    const steps : ChainableFunctionResult[] = [];
    const exec = async (i: number) => {
      try {
        const step = await _fns[i](nextAmountIn, _forward);
        nextAmountIn = step.amountOut;
        if (step.value) value = value.add(step.value);
        steps.push(step);
      } catch (e) {
        console.debug(`[farm/estimate] Failed to estimate step ${i}`, _fns[i].name, nextAmountIn, _forward);
        console.error(e);
        throw e;
      }
    };

    if (_forward) {
      for (let i = 0; i < _fns.length; i += 1) {
        await exec(i);
      }
    } else {
      for (let i = _fns.length - 1; i >= 0; i -= 1) {
        await exec(i);
      }
    }

    return {
      /// the resulting amountOut is just the argument
      /// that would've been passed to the next function
      amountOut: nextAmountIn,
      value,
      steps,
    };
  }

  /**
   * Encode function calls with a predefined slippage amount.
   * @param _steps from a previous call to `estimate()`
   * @param _slippage slippage passed as a percentage. ex. 0.1% slippage => 0.001
   * @returns array of strings containing encoded function data.
   */
  static encodeStepsWithSlippage(
    _steps: ChainableFunctionResult[],
    _slippage: number,
  ) {
    const fnData : string[] = [];
    for (let i = 0; i < _steps.length; i += 1) {
      const amountOut    = _steps[i].amountOut;
      const minAmountOut = Farm.slip(amountOut, _slippage);
      /// If the step doesn't have slippage (for ex, wrapping ETH),
      /// then `encode` should ignore minAmountOut
      const encoded      = _steps[i].encode(minAmountOut);
      fnData.push(encoded);
      console.debug(`[chain] encoding step ${i}: expected amountOut = ${amountOut}, minAmountOut = ${minAmountOut}`);
    }
    return fnData;
  }

  // ------------------------------------------

  buyBeans = (
    _initialFromMode? : FarmFromMode,
  ) => [
    // WETH -> USDT via tricrypto2 exchange
    this.exchange(
      this.contracts.curve.pools.tricrypto2.address,
      this.contracts.curve.registries.cryptoFactory.address,
      getChainConstant(WETH, this.provider.network.chainId).address,
      getChainConstant(USDT, this.provider.network.chainId).address,
      _initialFromMode
    ),
    // USDT -> BEAN via bean3crv exchange_underlying
    this.exchangeUnderlying(
      this.contracts.curve.pools.beanCrv3.address,
      getChainConstant(USDT, this.provider.network.chainId).address,
      getChainConstant(BEAN, this.provider.network.chainId).address,
    ),
  ]

  pair = {
    WETH_BEAN: (
      _tokenIn : 'WETH' | 'BEAN',
      _fromMode? : FarmFromMode,
      _toMode?: FarmToMode,
    ) => {
      // default: WETH -> BEAN; flip if input is BEAN
      const Weth = getChainConstant(WETH, this.provider.network.chainId).address;
      const Usdt = getChainConstant(USDT, this.provider.network.chainId).address;
      const Bean = getChainConstant(BEAN, this.provider.network.chainId).address;
      
      return _tokenIn === 'WETH'
        ? [
          this.exchange(
            this.contracts.curve.pools.tricrypto2.address,
            this.contracts.curve.registries.cryptoFactory.address,
            Weth,
            Usdt,
            _fromMode
          ),
          this.exchangeUnderlying(
            this.contracts.curve.pools.beanCrv3.address,
            Usdt,
            Bean,
            undefined, // default from mode
            _toMode
          ),
        ]
        : [
          this.exchangeUnderlying(
            this.contracts.curve.pools.beanCrv3.address,
            Bean,
            Usdt,
            _fromMode
          ),
          this.exchange(
            this.contracts.curve.pools.tricrypto2.address,
            this.contracts.curve.registries.cryptoFactory.address,
            Usdt,
            Weth,
            undefined, // default from mode
            _toMode
          ),
        ];
    }
  };

  // ------------------------------------------

  wrapEth = (
    _toMode : FarmToMode  = FarmToMode.INTERNAL,
  ) : ChainableFunction => async (_amountInStep: ethers.BigNumber) => {
    console.debug('[step@wrapEth] run', {
      _toMode,
      _amountInStep
    });
    return {
      name: 'wrapEth',
      amountOut: _amountInStep, // amountInStep should be an amount of ETH.
      value:     _amountInStep, // need to use this amount in the txn.
      encode: (_: ethers.BigNumber) => (
        this.contracts.beanstalk.interface.encodeFunctionData('wrapEth', [
          _amountInStep,        // ignore minAmountOut since there is no slippage
          _toMode,              //
        ])
      ),
      decode: (data: string) => this.contracts.beanstalk.interface.decodeFunctionData('wrapEth', data),
    };
  };

  unwrapEth = (
    /// Default to EXTERNAL because Beanstalk can't store INTERNAL ETH.
    _fromMode : FarmFromMode = FarmFromMode.INTERNAL,
  ) : ChainableFunction => async (_amountInStep: ethers.BigNumber) => {
    console.debug('[step@wrapEth] run', {
      _fromMode,
      _amountInStep
    });
    return {
      name: 'unwrapEth',
      amountOut: _amountInStep, // amountInStep should be an amount of ETH.
      encode: (_: ethers.BigNumber) => (
        this.contracts.beanstalk.interface.encodeFunctionData('unwrapEth', [
          _amountInStep,        // ignore minAmountOut since there is no slippage
          _fromMode,            //
        ])
      ),
      decode: (data: string) => this.contracts.beanstalk.interface.decodeFunctionData('unwrapEth', data),
    };
  };

  transferToken = (
    _tokenIn : string,
    _recipient : string,
    _fromMode : FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    _toMode : FarmToMode  = FarmToMode.INTERNAL,
  ) : ChainableFunction => async (_amountInStep: ethers.BigNumber) => {
    console.debug('[step@transferToken] run', {
      _fromMode,
      _toMode,
      _amountInStep,
    });
    return {
      name: 'transferToken',
      amountOut: _amountInStep, // transfer exact amount
      encode: (_: ethers.BigNumber) => (
        this.contracts.beanstalk.interface.encodeFunctionData('transferToken', [
          _tokenIn,      //
          _recipient,    //
          _amountInStep, // ignore minAmountOut since there is no slippage
          _fromMode,     //
          _toMode,       //
        ])
      ),
      decode: (data: string) => this.contracts.beanstalk.interface.decodeFunctionData('transferToken', data),
    };
  };

  // ------------------------------------------

  /**
   * Exchange tokens in a Curve pool.
   * @param _pool 
   * @param _registry 
   * @param _tokenIn 
   * @param _tokenOut 
   * @param _fromMode 
   * @param _toMode 
   * @returns ChainableFunctionResult
   */
  exchange = (
    _pool     : string,
    _registry : string,
    _tokenIn  : string,
    _tokenOut : string,
    _fromMode : FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    _toMode   : FarmToMode   = FarmToMode.INTERNAL,
  ) : ChainableFunction => async (_amountInStep: ethers.BigNumber, _forward : boolean = true) => {
    /// exchanges can be run in reverse
    const [tokenIn, tokenOut] = Farm.direction(_tokenIn, _tokenOut, _forward);

    console.debug(`[step@exchange] run [${_forward ? 'forward' : 'backward'}]:`, {
      _pool,
      _registry,
      _forward,
      tokenIn,
      tokenOut,
      _fromMode,
      _toMode,
      _amountInStep,
    });

    const registry = this.contracts.curve.registries[_registry];
    if (!registry) throw new Error(`Unknown registry: ${_registry}`);
    const [i, j] = await registry.callStatic.get_coin_indices(
      _pool,
      tokenIn,
      tokenOut,
      { gasLimit: 10000000 }
    );

    /// Get amount out based on the selected pool
    const poolAddr = _pool.toLowerCase();
    const pools = this.contracts.curve.pools;
    let amountOut;
    if (poolAddr === pools.tricrypto2.address.toLowerCase()) {
      amountOut = await pools.tricrypto2.callStatic.get_dy(
        i,
        j,
        _amountInStep,
        { gasLimit: 10000000 }
      );
    } else if (poolAddr === pools.pool3.address.toLowerCase()) {
      amountOut = await pools.pool3.callStatic.get_dy(
        i,
        j,
        _amountInStep,
        { gasLimit: 10000000 }
      );
    } else if (_registry === this.contracts.curve.registries.metaFactory.address) {
      amountOut = await CurveMetaPool__factory.connect(_pool, this.provider).callStatic['get_dy(int128,int128,uint256)'](
        i,
        j,
        _amountInStep,
        { gasLimit: 10000000 }
      );
    } else if (_registry === this.contracts.curve.registries.cryptoFactory.address) {
      amountOut = await CurvePlainPool__factory.connect(_pool, this.provider).callStatic.get_dy(
        i,
        j,
        _amountInStep,
        { gasLimit: 10000000 }
      );
    }

    if (!amountOut) throw new Error('No supported pool found');
    console.debug('[step@exchange] finish:', {
      i,
      j,
      amountOut: amountOut.toString(),
    });

    return {
      name: 'exchange',
      amountOut,
      encode: (minAmountOut: ethers.BigNumber) => (
        this.contracts.beanstalk.interface.encodeFunctionData('exchange', [
          _pool,
          _registry,
          tokenIn,
          tokenOut,
          _amountInStep,
          minAmountOut,
          _fromMode,
          _toMode,
        ])
      ),
      decode: (data: string) => this.contracts.beanstalk.interface.decodeFunctionData('exchange', data),
      data: {
        pool: _pool,
        registry: _registry,
        tokenIn,
        tokenOut,
        fromMode: _fromMode,
        toMode: _toMode,
      }
    };
  }

  /**
   * Exchange underlying tokens in a Curve metapool.
   * @param _pool 
   * @param _tokenIn 
   * @param _tokenOut 
   * @param _fromMode 
   * @param _toMode 
   * @returns ChainableFunctionResult
   */
  exchangeUnderlying = (
    _pool     : string,
    _tokenIn  : string,
    _tokenOut : string,
    _fromMode : FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    _toMode   : FarmToMode   = FarmToMode.INTERNAL,
  ) : ChainableFunction => async (_amountInStep: ethers.BigNumber, _forward : boolean = true) => {
    /// exchangeUnderlying can be estimated in reverse
    const [tokenIn, tokenOut] = Farm.direction(_tokenIn, _tokenOut, _forward);

    console.debug(`[step@exchangeUnderlying] run [${_forward ? 'forward' : 'backward'}]`, {
      _pool,
      tokenIn,
      tokenOut,
      _forward,
      _fromMode,
      _toMode,
      _amountInStep,
    });
    
    const registry = this.contracts.curve.registries.metaFactory;
    const [i, j] = await registry.get_coin_indices(
      _pool,
      tokenIn,
      tokenOut,
      { gasLimit: 1000000 }
    );
    
    /// Only MetaPools have the ability to exchange_underlying
    /// FIXME: 3pool also has a single get_dy_underlying method, will we ever use this?
    const amountOut = await CurveMetaPool__factory.connect(_pool, this.provider).callStatic['get_dy_underlying(int128,int128,uint256)'](
      i, // i = USDT = coins[3] ([0=BEAN, 1=CRV3] => [0=BEAN, 1=DAI, 2=USDC, 3=USDT])
      j, // j = BEAN = coins[0]
      _amountInStep,
      { gasLimit: 10000000 }
    );
    
    //
    if (!amountOut) throw new Error('No supported pool found');
    console.debug('[step@exchangeUnderlying] finish: ', {
      i,
      j,
      amountOut: amountOut.toString(),
    });

    return {
      name: 'exchangeUnderlying',
      amountOut,
      encode: (minAmountOut: ethers.BigNumber) => (
        this.contracts.beanstalk.interface.encodeFunctionData('exchangeUnderlying', [
          _pool,
          tokenIn,
          tokenOut,
          _amountInStep,
          minAmountOut,
          _fromMode,
          _toMode,
        ])
      ),
      decode: (data: string) => this.contracts.beanstalk.interface.decodeFunctionData('exchangeUnderlying', data),
      data: {
        pool: _pool,
        tokenIn,
        tokenOut,
        fromMode: _fromMode,
        toMode: _toMode,
      }
    };
  }

  /**
   * Add liquidity to a Curve pool.
   * Supports tricrypto2, 3pool, metapools, crypto pools.
   * @param _pool 
   * @param _tokenIn 
   * @param _tokenOut 
   * @param _fromMode 
   * @param _toMode 
   * @returns ChainableFunctionResult
   */
  addLiquidity(
    _pool     : string,
    _registry : string,
    _amounts  : (
      readonly   [number, number]
      | readonly [number, number, number]
    ),
    _fromMode : FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    _toMode   : FarmToMode   = FarmToMode.INTERNAL,
  ) : ChainableFunction {
    return async (_amountInStep: ethers.BigNumber) => {
      console.debug('[step@addLiquidity] run: ', {
        _pool,
        _registry,
        _amounts,
        _fromMode,
        _toMode,
        _amountInStep,
      });

      /// [0, 0, 1] => [0, 0, amountIn]
      const amountInStep = _amounts.map((k) => (k === 1 ? _amountInStep : ethers.BigNumber.from(0)));

      /// Get amount out based on the selected pool
      const poolAddr = _pool.toLowerCase();
      const pools = this.contracts.curve.pools;
      let amountOut;
      if (poolAddr === pools.tricrypto2.address.toLowerCase()) {
        assert(amountInStep.length === 3);
        amountOut = await pools.tricrypto2.callStatic.calc_token_amount(
          amountInStep as [any, any, any], // [DAI, USDC, USDT]; assumes that amountInStep is USDT
          true, // _is_deposit
          { gasLimit: 10000000 }
        );
      } else if (poolAddr === pools.pool3.address.toLowerCase()) {
        assert(amountInStep.length === 3);
        amountOut = await pools.pool3.callStatic.calc_token_amount(
          amountInStep as [any, any, any],
          true, // _is_deposit
          { gasLimit: 10000000 }
        );
      } else if (_registry === this.contracts.curve.registries.metaFactory.address) {
        assert(amountInStep.length === 2);
        amountOut = await CurveMetaPool__factory.connect(_pool, this.provider).callStatic['calc_token_amount(uint256[2],bool)'](
          amountInStep as [any, any],
          true, // _is_deposit
          { gasLimit: 10000000 }
        );
      } else if (_registry === this.contracts.curve.registries.cryptoFactory.address) {
        assert(amountInStep.length === 2);
        amountOut = await CurvePlainPool__factory.connect(_pool, this.provider).callStatic.calc_token_amount(
          amountInStep as [any, any],
          true, // _is_deposit
          { gasLimit: 10000000 }
        );
      }

      if (!amountOut) throw new Error('No supported pool found');
      console.debug('[step@addLiquidity] finish: ', {
        amountInStep: amountInStep.toString(),
        amountOut: amountOut.toString(),
      });
      
      return {
        name: 'addLiquidity',
        amountOut,
        encode: (minAmountOut: ethers.BigNumber) => (
          this.contracts.beanstalk.interface.encodeFunctionData('addLiquidity', [
            _pool,
            _registry,
            amountInStep as any[], // could be 2 or 3 elems
            minAmountOut,
            _fromMode,
            _toMode,
          ])
        ),
        decode: (data: string) => this.contracts.beanstalk.interface.decodeFunctionData('addLiquidity', data),
        data: {
          pool: _pool,
          registry: _registry,
          fromMode: _fromMode,
          toMode: _toMode,
        }
      };
    };
  }

  /**
   * Remove liquidity from a Curve pool as a single token.
   * Supports: tricrypto2, 3pool, metapools, crypto pools.
   * @param _pool 
   * @param _registry 
   * @param _tokenOut 
   * @param _fromMode 
   * @param _toMode 
   * @returns 
   */
  removeLiquidityOneToken(
    _pool     : string,
    _registry : string,
    _tokenOut : string,
    _fromMode : FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    _toMode   : FarmToMode = FarmToMode.INTERNAL,
  ) : ChainableFunction {
    // _amountInStep is an an amount of LP token
    return async (_amountInStep: ethers.BigNumber) => {
      const registry = this.contracts.curve.registries.metaFactory;
      const coins = await registry.callStatic.get_coins(_pool, { gasLimit: 10000000 });
      const i = coins.findIndex((addr) => addr.toLowerCase() === _tokenOut.toLowerCase());
      
      /// FIXME: only difference between this and addLiquidity is the boolean
      /// Get amount out based on the selected pool
      const poolAddr = _pool.toLowerCase();
      const pools = this.contracts.curve.pools;
      let amountOut;
      if (poolAddr === pools.tricrypto2.address.toLowerCase()) {
        amountOut = await pools.tricrypto2.callStatic.calc_withdraw_one_coin(
          _amountInStep,
          i,
          { gasLimit: 10000000 }
        );
      } else if (poolAddr === pools.pool3.address.toLowerCase()) {
        amountOut = await pools.pool3.callStatic.calc_withdraw_one_coin(
          _amountInStep,
          i,
          { gasLimit: 10000000 }
        );
      } else if (_registry === this.contracts.curve.registries.metaFactory.address) {
        amountOut = await CurveMetaPool__factory.connect(_pool, this.provider).callStatic['calc_withdraw_one_coin(uint256,int128)'](
          _amountInStep,
          i,
          { gasLimit: 10000000 }
        );
      } else if (_registry === this.contracts.curve.registries.cryptoFactory.address) {
        amountOut = await CurvePlainPool__factory.connect(_pool, this.provider).callStatic.calc_withdraw_one_coin(
          _amountInStep,
          i,
          { gasLimit: 10000000 }
        );
      }

      if (!amountOut) throw new Error('No supported pool found');
      console.debug(`[step@removeLiquidity] amountOut=${amountOut.toString()}`);

      return {
        name: 'removeLiquidityOneToken',
        amountOut,
        encode: (minAmountOut: ethers.BigNumber) => (
          this.contracts.beanstalk.interface.encodeFunctionData('removeLiquidityOneToken', [
            _pool,
            _registry,
            _tokenOut,
            _amountInStep,
            minAmountOut,
            _fromMode,
            _toMode,
          ])
        ),
        decode: (data: string) => this.contracts.beanstalk.interface.decodeFunctionData('removeLiquidityOneToken', data),
        data: {}
      };
    };
  }
}
