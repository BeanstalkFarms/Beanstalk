import React from 'react';

export const EXAMPLE_TOOLTIP = '';

export const WHITELIST_TOOLTIPS: { [key: string]: any | React.ReactElement; } = {
  BEAN: ''
};

/** Pod Marketplace specific tooltips */
export const POD_MARKET_TOOLTIPS: { [key: string]: any | React.ReactElement } = {
  start: 'The start index in this Plot that you would like to List.',
  end: 'The end index in this Plot that you would like to List.',
  amount: 'Number of Pods to List based on the start and end indices.',
  pricePerPodOrder: 'How much to pay for each Pod, denominated in Beans.',
  pricePerPodListing: 'How much to sell each Pod for, denominated in Beans.',
  expiresAt: 'When this many Pods become Harvestable, this Listing will expire.',
};

export const UNRIPE_ASSET_TOOLTIPS : { [key: string]: string | React.ReactElement } = {
  // Beans
  circulatingBeans: 'Beans that were in Farmers\' wallets.',
  withdrawnBeans:   'Beans that were Withdrawn from the Silo. This includes "Withdrawn" and "Claimable" Beans shown on the pre-exploit Beanstalk UI.',
  harvestableBeans: 'Beans from Harvestable Plots that weren\'t yet Harvested.',
  orderedBeans:     'Beans that were stored in Pod Orders.',
  farmableBeans:    (
    <>Previously called <em>Farmable Beans</em> — Beans earned from Silo rewards that had not yet been Deposited in a particular Season.</>
  ),
  farmBeans:     'Beans that were stored in Beanstalk but not Deposited.',
  // LP
  circulatingBeanEthLp:   'BEAN:ETH LP tokens that were in Farmers\' wallets. The number of tokens and associated BDV are shown.',
  circulatingBeanLusdLp:  'BEAN:LUSD LP tokens that were in Farmers\' wallets. The number of tokens and associated BDV are shown.',
  circulatingBean3CrvLp:  'BEAN:3CRV LP tokens that were in Farmers\' wallets. The number of tokens and associated BDV are shown.',
  withdrawnBeanEthLp:     'BEAN:ETH LP tokens that were Withdrawn from the Silo. The number of tokens and associated BDV are shown. This includes "Withdrawn" and "Claimable" BEAN:ETH tokens shown on the pre-exploit Beanstalk UI.',
  withdrawnBeanLusdLp:    'BEAN:LUSD LP tokens that were Withdrawn from the Silo. The number of tokens and associated BDV are shown. This includes "Withdrawn" and "Claimable" BEAN:LUSD tokens shown on the pre-exploit Beanstalk UI.',
  withdrawnBean3CrvLp:    'BEAN:3CRV LP tokens that were Withdrawn from the Silo. The number of tokens and associated BDV are shown. This includes "Withdrawn" and "Claimable" BEAN:3CRV tokens shown on the pre-exploit Beanstalk UI.',
  // circulatingBeanEthBdv: 'TODO: add tooltip in constants/tooltips.ts',
  // circulatingBeanLusdBdv: 'TODO: add tooltip in constants/tooltips.ts',
  // circulatingBean3CrvBdv: 'TODO: add tooltip in constants/tooltips.ts',
  // withdrawnBeanEthBdv: 'TODO: add tooltip in constants/tooltips.ts',
  // withdrawnBeanLusdBdv: 'TODO: add tooltip in constants/tooltips.ts',
  // withdrawnBean3CrvBdv: 'TODO: add tooltip in constants/tooltips.ts',
};
