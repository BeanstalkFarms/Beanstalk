import { BeanstalkSDK, ERC20Token, Token, TokenValue, FarmToMode, FarmFromMode, Clipboard  } from "@beanstalk/sdk";

import { ethers } from "ethers";

import { impersonate, signer } from "../setup";


main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
}).finally(() => process.exit());

function display(str: string[]) {
  const strings = str.map((s, i) => {
    if (i === 0) {
      return s.padEnd(15);
    } else {
      const ss = s.substring(0, 12);
      const _s = ss.padStart(15);
      const __s = _s.padEnd(20);
      return __s;
    }
  })
  
  console.log(strings.join("|"));
}

async function main() {
  const me = "0xC5581F1aE61E34391824779D505Ca127a4566737";
  const addy = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
  const { sdk, stop } = await impersonate(addy);
  const acc = await sdk.getAccount();

  sdk.DEBUG = false;

  const tokens = [
    sdk.tokens.BEAN,
    sdk.tokens.CRV3,
    sdk.tokens.ETH,
    sdk.tokens.USDT,
    sdk.tokens.USDC,
    sdk.tokens.DAI,
  ];

  const [
    tokenIn, 
    target, 
    amount, 
    from, 
    to
  ] = [sdk.tokens.ETH, sdk.tokens.BEAN_CRV3_LP, 10, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL];

  const preSiloBalance = await sdk.silo.getBalances(acc);

  for (const token of tokens) {
    const bal = await token.getBalance(acc);
    console.log(token.symbol, bal.toHuman());
  }

  const preBalanceMap = new Map<Token, any>();
  const postBalanceMap = new Map<Token, any>();
  for (const tk of tokens) {
    const bal = await tk.getBalance(acc);
    preBalanceMap.set(tk, bal);
  }

  // build workflow
  await deposit(sdk, tokenIn, target, amount, from);
  await stop();
}

async function pipeDeposit(sdk: BeanstalkSDK, tokenIn: Token, target: Token, _amount: number) {
  const amount = tokenIn.fromHuman(_amount);
  const farm = sdk.farm.create("claimAnddeposit");
  const pipe = sdk.farm.createAdvancedPipe();

  const account = await sdk.getAccount();

  await tokenIn.approveBeanstalk(TokenValue.MAX_UINT256).then((r) => r.wait());

  // load pipeline
  // index = 0;
  farm.add(
    sdk.farm.presets.loadPipeline(
      tokenIn as ERC20Token, 
      FarmFromMode.INTERNAL_EXTERNAL), 
      { onlyExecute: true, tag: "loadPipeline" }
    );
  
  // wrap ETH
  farm.add(new sdk.farm.actions.WrapEth(FarmToMode.INTERNAL));
  const exchange = sdk.farm.presets.bean2weth();
  await exchange

  farm.add(
    new sdk.farm.actions.ExchangeUnderlying(
      sdk.contracts.curve.pools.beanCrv3.address, 
      sdk.tokens.USDT, 
      sdk.tokens.BEAN, 
      FarmFromMode.INTERNAL_TOLERANT
    ), {
      onlyLocal: true
    }
  );

  // transfer to INTERNAL / EXTERNAL
  pipe.add(async (amountInStep, context) => {
    await target.approveBeanstalk(TokenValue.MAX_UINT256).then((r) => r.wait());
    return pipe.wrap(
      sdk.contracts.beanstalk,
      "transferToken",
      [
        target.address,
        account,
        amountInStep.toString(),
        FarmFromMode.EXTERNAL,
        FarmToMode.EXTERNAL
      ],
      amountInStep
    )
  })

  farm.add(pipe);

  // Estimate
  const amountOut = await farm.estimate(amount);
  console.log("Estimated amountOut:", target.fromBlockchain(amountOut).toHuman());

  // Run
  const txn = await farm.execute(amount, {
    slippage: 0.1
  });

  await txn.wait();
  console.log("Success!: ");

}




async function deposit(sdk: BeanstalkSDK, tokenIn: Token, target: Token, _amount: number, from: FarmFromMode) {
  const account = await sdk.getAccount();
  const pool = sdk.pools.getPoolByLPToken(sdk.tokens.BEAN_CRV3_LP);
  const amountIn = tokenIn.fromHuman(_amount);

  // create workflow
  const advanced = sdk.farm.createAdvancedPipe();

  const work = sdk.farm.create();

  let depositAmount;
  let depositFrom;

  const isEth = tokenIn.symbol === "ETH";
  const isEthOrWeth = isEth || tokenIn.equals(sdk.tokens.WETH);

  if (tokenIn.equals(target)) {
    depositAmount = _amount;
    depositFrom = FarmFromMode.INTERNAL_EXTERNAL;
  } else {
    depositAmount = _amount;
    depositFrom = FarmFromMode.INTERNAL_TOLERANT;
  }

  // if whitelisted token is BEAN
  if (target.equals(sdk.tokens.BEAN)) {
    if (isEthOrWeth) {
      if (isEth) {
        work.add(new sdk.farm.actions.WrapEth(FarmToMode.INTERNAL));
      }
      work.add(sdk.farm.presets.weth2bean())
    }
    work.add(async (_amountInStep) => {
      return sdk.contracts.beanstalk.interface.encodeFunctionData("deposit", [
        target.address,
        _amountInStep,
        depositFrom,
      ])
    });

    advanced.add(work);

    const estimate = await advanced.estimate(amountIn);
    console.log("estimate: ", estimate);
    // const txn = await work.execute(amountIn, { slippage: 0.1 });
    // txn.wait();

    // console.log("txn: ", txn);

    for (const s of await work.summarizeSteps()) {
      console.log(
        "step:", 
        "\tname: ", s.name, "\n",
        '\tamount: ', s.amountOut.toString()
      )
    }
  }

  else {
    await tokenIn.approveBeanstalk(amountIn);
    const deposit = await sdk.silo.buildDeposit(target, account);
    deposit.setInputToken(tokenIn);

    const est = await deposit.estimate(amountIn);
    console.log("estimate: ", est);
    advanced.add(deposit.workflow);
    
    const txr = await deposit.execute(amountIn, 0.1);
    await txr.wait();

    console.log("txn: ", txr);
    console.log("DONE");

    for (const s of await deposit.getSummary()) {
      console.log(
        "step:", 
        s,
        "\n"
      )
    }
  }
}
