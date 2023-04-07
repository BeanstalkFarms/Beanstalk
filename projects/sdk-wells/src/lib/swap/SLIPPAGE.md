# How we calculate slippage

```js
// 1 BTC = 10 WETH
// 1 WETH = 1000 BEAN
// 1 BEAN = 0.5 FOO
// Swap 1 WETH to FOO... so 1 WETH -> 1000 BEAN -> 500 FOO

// parameters:
// swapFromQuote(from, to, fromAmount)
// swapFrom(from, to, fromAmount, minAmountOut)


// use slippage only in swap operation
AMOUNT_IN = 0.1 BTC
q0 = swapFromQuote(btc, weth, 0.1) // 1 WETH
q1 = swapFromQuote(weth, bean, 1); // 1000 BEAN
q2 = swapFromQuote(bean, foo, 1000) // 500 FOO

s0 = swapFrom(btc, weth, 0.1, .00) = .99 - 1
s1 = swapFrom(weth, bean, .99-1 , 990) = 990 - 1000
s2 = swapFrom(bean, foo, 1000, 495) = 495 - 500

// with vars
q1 = swapFromQuote(btc, weth, AMOUNT_IN) // 1 WETH
q1slipp = q1 * .99    // .99 WETh
q2 = swapFromQuote(weth, bean, q1); // 1000 BEAN
q2slipp = q2 * .99    // 990
q3 = swapFromQuote(bean, foo, q2) // 500 FOO
q3slipp = q3 * .99    // 495

s1 = swapFrom(btc, weth, AMOUNT_IN, q1slipp) = .99 - 1
s2 = swapFrom(weth, bean, s1 , q1slipp) = 990 - 1000   // use clipboard for s1
s3 = swapFrom(bean, foo, s2, q3slipp) = 495 - 500      // use clipboard for s2



////////////////////////// REVERSE //////////////////////////

// 1 BTC = 10 WETH
// BTC -> FOO, want 500 FOO
// swapToQuote(from, to, amountOut)
// swapTo(from, to, maxAmountIn, amountOut)

AMOUNT_OUT = 500 FOO
// quote w/Slippage
q1 = swapToQuote(bean, foo, 500)    // 1000 or 1010 BEAN
q2 = swapToQuote(weth, bean, 1010)  // 1 or 1.01 WETH
q3 = swapToQuote(btc, weth, 1.01)   // 0.101 or 0.10201 BTC

s0 = swapTo(btc, weth, 0.10201, 0.101)  // spends 0.101 - 0.10201  ( diff 0.00101 ) BTC
s1 = swapTo(weth, bean, 1.01, 1010)     // spends 1.0
s2 = swapTo(bean, foo, 1010, 500)

//withvars
q1 = swapToQuote(bean, foo, AMOUNT_OUT)
q1slipp = q1*1.01;
q2 = swapToQuote(weth, bean, q1slipp) 
q2slippg = q2 * 1.01;
q3 = swapToQuote(btc, weth, q2slipp) 
q3slippg = q3 * 1.01;

s0 = swapTo(btc, weth, q3slipp, q2slipp) 
s1 = swapTo(weth, bean, q2slipp, q1slipp)    
s2 = swapTo(bean, foo, q1slipp, AMOUNT_OUT)




```