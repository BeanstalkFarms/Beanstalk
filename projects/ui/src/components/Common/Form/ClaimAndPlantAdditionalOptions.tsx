import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Switch, Typography } from '@mui/material';
import { useFormikContext } from 'formik';
import AddIcon from '@mui/icons-material/Add';
import Row from '../Row';
import SelectionAccordion from '~/components/Common/Selection/SelectionAccordion';
import { ClaimPlantAction } from '~/hooks/beanstalk/useClaimAndPlantActions';
import useFarmerClaimPlantOptions from '~/hooks/farmer/useFarmerClaimAndPlantOptions';
import ClaimPlantAccordionCard from '../Selection/ClaimPlantOptionCard';
import { ClaimAndPlantFormState } from '.';

const ClaimAndPlantAdditionalOptions: React.FC<{}> = () => {
  /// State
  const [local, setLocal] = useState<Set<ClaimPlantAction>>(new Set());

  /// Helpers
  const { options: claimPlantOptions } = useFarmerClaimPlantOptions();

  /// Formik
  const { values: { farmActions }, setFieldValue } = useFormikContext<ClaimAndPlantFormState>();

  const [options, required, enabled, allToggled] = useMemo(() => {
    // the options are the complement of values.options
    const complement = new Set(Object.keys(ClaimPlantAction) as ClaimPlantAction[]);
    farmActions.options.forEach((opt) => complement.delete(opt));

    const _options = Array.from(complement.values());
    const _required = new Set(farmActions.additional.required?.filter((opt) => 
      claimPlantOptions[opt].enabled
    ));
    const _enabled = _options.filter((opt) => claimPlantOptions[opt].enabled);
    const _allToggled = _enabled.every((action) => local.has(action)) || false;

    return [
      complement,
      _required,
      _enabled,
      _allToggled,
    ];
  }, [farmActions.options, farmActions.additional.required, claimPlantOptions, local]);

  /// Handlers
  const handleOnToggle = useCallback((item: ClaimPlantAction) => {
    const copy = new Set([...local]);
    if (copy.has(item) && !required.has(item)) {
      copy.delete(item);
    } else {
      copy.add(item);
    }
    setLocal(copy);
    setFieldValue('farmActions.additional.selected', Array.from(copy));
  }, [local, required, setFieldValue]);

  const handleOnToggleAll = useCallback(() => {
    const newSet = new Set([...(allToggled ? required : enabled)]);
    setLocal(newSet);
    setFieldValue('farmActions.additional.selected', newSet);
  }, [allToggled, required, enabled, setFieldValue]);

  useEffect(() => {
    if (required.size) {
      const hasAllRequired = [...required].every((opt) => local.has(opt));
      if (!hasAllRequired) {
        const updatedSelected = new Set([...local, ...required]);
        setLocal(updatedSelected);
        setFieldValue('farmActions.additional.selected', updatedSelected);
      }
    }
  }, [local, required, setFieldValue]);

  return (
    <SelectionAccordion<ClaimPlantAction>
      title={
        <Row gap={0.5}>
          <AddIcon fontSize="small" color="primary" />
          <Typography color="primary.main">Add additional transactions to save gas</Typography>
        </Row>
      }
      subtitle={
        <Row 
          width="100%" 
          justifyContent="space-between" 
          // We add a negative margin b/c the MUI switch component has padding of 12px, and 
          // removing the padding from the switch component causes unexpected behavior
          sx={{ my: '-12px' }}>
          <Typography color="text.secondary">Claim All</Typography>
          <Switch
            checked={allToggled}
            onClick={handleOnToggleAll}
            disabled={!enabled.length || enabled.length === 1}
          />
        </Row>
      }
      options={options}
      selected={local}
      onToggle={handleOnToggle}
      render={(item, selected) => (
        <ClaimPlantAccordionCard 
          option={item}
          summary={claimPlantOptions[item]}
          selected={selected}
        />
      )}  
    />
  );
};

export default ClaimAndPlantAdditionalOptions;
