import React, { useCallback, useEffect, useState } from 'react';
import { useFormikContext } from 'formik';
import SelectionAccordion from '~/components/Common/Accordion/SelectionAccordion';

import useFarmerClaimPlantOptions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantOptions';

import ClaimPlantAccordionPill from '~/components/Common/Form/ClaimPlantOptionPill';
import ClaimPlantAccordionCard from '~/components/Common/Form/ClaimPlantOptionCard';
import { ClaimAndPlantFormState } from '.';
import useToggle from '~/hooks/display/useToggle';
import { ClaimPlantAction } from '~/util/ClaimPlant';

const presets = {
  claim: {
    options: [
      ClaimPlantAction.RINSE,
      ClaimPlantAction.HARVEST,
      ClaimPlantAction.CLAIM,
    ],
    variant: 'pill',
  },
  plant: {
    options: [
      ClaimPlantAction.PLANT
    ],
    variant: 'card',
  },
};

type Props = {
  preset: keyof typeof presets;
}

const ClaimAndPlantFarmActions: React.FC<Props> = ({ preset }) => {
  /// Formik
  const { values: { farmActions }, setFieldValue } = useFormikContext<ClaimAndPlantFormState>();

  /// State
  const [local, setLocal] = useState<Set<ClaimPlantAction>>(new Set(farmActions.selected));
  const [open, show, hide] = useToggle();

  /// Helpers
  const { options } = useFarmerClaimPlantOptions();

  /// Handlers
  const handleOnToggle = useCallback((item: ClaimPlantAction) => {
    const copy = new Set([...local]);
    if (copy.has(item)) {
      copy.delete(item);
    } else {
      copy.add(item);
    }
    setLocal(copy);
    setFieldValue('farmActions.selected', Array.from(copy));
  }, [setFieldValue, local]);

  useEffect(() => {
    if (farmActions.selected.length === 0) {
      setLocal(new Set());
      hide();
    }
  }, [farmActions.selected, hide, local.size]);

  return (
    <SelectionAccordion<ClaimPlantAction>
      open={open}
      onChange={open ? hide : show}
      title="Add Claimable Assets to this transaction"
      options={presets[preset].options}
      selected={local}
      onToggle={handleOnToggle}
      sx={{ borderRadius: 1 }}
      direction="row"
      render={(item, selected) => {
        const sharedProps = { option: item, summary: options[item], selected };

        switch (presets[preset].variant) {
          case 'card': {
            return (
              <ClaimPlantAccordionCard {...sharedProps} />
            );
          }
          case 'pill': {
            return (
              <ClaimPlantAccordionPill {...sharedProps} />
            );
          }
          default:
            return null;
        }
      }}
    />
  );
};

export default ClaimAndPlantFarmActions;
