import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormikContext } from 'formik';
import SelectionAccordion from '~/components/Common/Accordion/SelectionAccordion';

import useFarmerClaimPlantOptions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantOptions';

import ClaimPlantAccordionPill from '~/components/Common/Form/ClaimPlantOptionPill';
import ClaimPlantAccordionCard from '~/components/Common/Form/ClaimPlantOptionCard';
import { ClaimAndPlantFormState } from '.';
import useToggle from '~/hooks/display/useToggle';
import { ClaimPlantAction } from '~/util/ClaimPlant';

const ClaimAndPlantFarmActions: React.FC<{}> = () => {
  /// Formik
  const formik = useFormikContext<ClaimAndPlantFormState>();
  const { values: { farmActions }, setFieldValue } = formik;

  /// State
  const [local, setLocal] = useState<Set<ClaimPlantAction>>(
    new Set(farmActions.selected || [])
  );
  const [open, show, hide] = useToggle();

  /// Helpers
  const { options } = useFarmerClaimPlantOptions();
  
  const formOptions = useMemo(() => {
    const isPlant = farmActions.options.includes(ClaimPlantAction.PLANT);
    const someEnabled = farmActions.options.find((opt) => options[opt].enabled);

    return {
      options: farmActions.options,
      variant: isPlant ? 'card' : 'pill',
      title: isPlant 
        ? 'Add before this transaction'
        : 'Add Claimable Assets to this transaction',
      noneEnabled: !someEnabled
    };
  }, [farmActions.options, options]);

  /// Handlers
  const handleOnToggle = useCallback(
    (item: ClaimPlantAction) => {
      const copy = new Set([...local]);
      if (copy.has(item)) {
        copy.delete(item);
      } else {
        copy.add(item);
      }
      setLocal(copy);
      setFieldValue('farmActions.selected', Array.from(copy));
    },
    [setFieldValue, local]
  );

  /// Effects
  useEffect(() => {
    if (!farmActions.selected && local.size) {
      setLocal(new Set());
      hide();
    }
  }, [farmActions.selected, hide, local.size]);

  if (formOptions.noneEnabled) return null;

  return (
    <SelectionAccordion<ClaimPlantAction>
      open={open}
      onChange={open ? hide : show}
      title={formOptions.title}
      options={formOptions.options}
      selected={local}
      onToggle={handleOnToggle}
      sx={{ borderRadius: 1 }}
      direction="row"
      render={(item, selected) => {
        const sharedProps = { option: item, summary: options[item], selected };

        switch (formOptions.variant) {
          case 'card': {
            return <ClaimPlantAccordionCard {...sharedProps} />;
          }
          case 'pill': {
            return <ClaimPlantAccordionPill {...sharedProps} />;
          }
          default:
            return null;
        }
      }}
    />
  );
};

export default ClaimAndPlantFarmActions;
