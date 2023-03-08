import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormikContext } from 'formik';
import SelectionAccordion from '~/components/Common/Accordion/SelectionAccordion';

import useFarmerClaimPlantOptions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantOptions';

import ClaimPlantAccordionPill from '~/components/Common/Form/ClaimPlantOptionPill';
import ClaimPlantAccordionCard from '~/components/Common/Form/ClaimPlantOptionCard';
import { ClaimAndPlantFormState } from '.';
import useToggle from '~/hooks/display/useToggle';
import { ClaimPlantAction, ClaimPlantFormPresets } from '~/util/ClaimPlant';

const getConfig = (key: keyof typeof ClaimPlantFormPresets) => {
  switch (key) {
    case 'plant':  {
      return {
        variant: 'card',
        title: 'Add before this transaction',
      };
    }
    default: {
      return {
        variant: 'pill',
        title: 'Add Claimable Assets to this transaction',
      };
    }
  }
};

const ClaimAndPlantFarmActions: React.FC<{}> = () => {
  /// Formik
  const formik = useFormikContext<ClaimAndPlantFormState>();
  const { values: { farmActions }, setFieldValue } = formik;

  /// State
  const [local, setLocal] = useState<Set<ClaimPlantAction>>(new Set(farmActions.selected || []));
  const [open, show, hide] = useToggle();

  /// Helpers
  const { options } = useFarmerClaimPlantOptions();

  const formItems = useMemo(() => {
    const preset = ClaimPlantFormPresets[farmActions.preset];
    const config = getConfig(farmActions.preset);
    const someEnabled = preset.options.find((opt) => options[opt].enabled);

    return {
      ...config,
      options: preset.options,
      noneEnabled: !someEnabled
    };
  }, [farmActions.preset, options]);
  
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

  if (formItems.noneEnabled) return null;

  return (
    <SelectionAccordion<ClaimPlantAction>
      open={open}
      onChange={open ? hide : show}
      title={formItems.title}
      options={formItems.options}
      selected={local}
      onToggle={handleOnToggle}
      sx={{ borderRadius: 1 }}
      direction="row"
      render={(item, selected) => {
        const sharedProps = { option: item, summary: options[item], selected };

        switch (formItems.variant) {
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
