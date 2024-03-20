import React from 'react';
import { Tab } from '@mui/material';
import useTabs from '~/hooks/display/useTabs';
import BadgeTab from '~/components/Common/BadgeTab';
import useFarmerFertilizer from '~/hooks/farmer/useFarmerFertilizer';
import { Module, ModuleContent, ModuleTabs } from '~/components/Common/Module';
import { FC } from '~/types';
import Rinse from './Rinse';
import Buy from './Buy';
import Transfer from './Transfer';

const SLUGS = ['buy', 'rinse', 'transfer'];

const BarnActions: FC<{}> = () => {
  const [tab, handleChange] = useTabs(SLUGS, 'action');
  const farmerFertilizer = useFarmerFertilizer();
  return (
    <Module>
      <ModuleTabs value={tab} onChange={handleChange}>
        <Tab label="Buy" />
        <BadgeTab
          showBadge={farmerFertilizer.fertilizedSprouts.gt(0)}
          label="Rinse"
        />
        <Tab label="Transfer" />
      </ModuleTabs>
      <ModuleContent>
        {tab === 0 ? <Buy /> : null}
        {tab === 1 ? <Rinse /> : null}
        {tab === 2 ? <Transfer /> : null}
      </ModuleContent>
    </Module>
  );
};

export default BarnActions;
