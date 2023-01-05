# BIP-5: Omnisca Audit

- [Summary](#summary)
- [Problem](#problem)
- [Proposed Solution](#proposed-solution)
- [Payment](#payment)
- [Fundraiser Rationale](#fundraiser-rationale)
- [User Interface](#user-interface)

## Summary:

- Hire Omniscia to perform a code audit on Beanstalk.
- Leverage the "Fundraiser" process proposed in BIP-4 to mint the Beans and raise the USDC necessary to pay for the Omniscia audit.
- Mint 155,000 Beans and create a Fundraiser to raise 140,000 USDC in exchange for 140,000 Bean. Pay Omniscia 140,000 USDC + 15,000 Beans for the audit.

## Problem:

### Audit

Beanstalk is unaudited at the moment.  A high quality audit will facilitate further growth and adoption.

There are regular updates to the code through BIPs. It is important to have an auditor that will continue working with Beanstalk after the initial audit to facilitate timely and efficient code reviews for BIPs.

### Paying for the Audit

Until Beanstalk has sufficiently established Beans as a reliable stablecoin such that Beanstalk can make all payments in Beans, Beanstalk needs a way to pay for things (including this audit) in other stablecoins. Thus, Beanstalk needs a way to convert Beans to a traditional stablecoin without having to sell a large amount of Beans in the Uniswap pool.

## Proposed Solution:

### Audit

Publius has connected with Omniscia. Omniscia is a very high quality smart contract auditor, and has experience auditing other ERC-2535 Diamonds. Their audit history is available here: [https://omniscia.io/index.html#clients](https://omniscia.io/index.html#clients). Publius was very impressed by them and thinks the audit they have offered to perform on Beanstalk will add a lot of value to the process of securing Beanstalk.

Omniscia has also expressed interest in maintaining a continuous relationship with Beanstalk.

Upon passage of this BIP, Omniscia will perform an initial audit for Beanstalk.

### Paying for the Audit

This BIP leverages the "Fundraiser" standard proposed in BIP-4 that allows Beanstalk to raise money to pay for things in other stablecoins.

## Payment:

The cost of the contract (initial audit) is 140,000 USDC and 15,000 Beans, paid in 3 payments.

Upon approval, this BIP will mint 155,000 Beans to fund the Omniscia audit and start a Fundraiser for 140,000 USDC. Upon the start of the Fundraiser, anyone can send USDC to the FundraiserFacet in exchange for sown Beans. For each of the first 140,000 USDC sent to the FundraiserFacet, 1 Bean will be sown and the corresponding Pods returned to the sender based on the Weather at the time of the sow.

Upon completion of the sale of the first 55,000 Beans for 55,000 USDC, Publius will submit the first payment to Omniscia, and make subsequent payments as appropriate.

## Fundraiser Rationale:

Having multiple auditors working on Beanstalk is fundamental to developing Beanstalk in a decentralized capacity. Omniscia is highly qualified to perform an audit on Beanstalk, and a good firm to continue auditing Beanstalk as it grows.

## User Interface:

The Fundraiser will leverage the new "Fundraiser" page proposed in BIP-4 that will allow anyone to participate in active Fundraisers.
