import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Switch, Typography } from '@mui/material';
import { useFormikContext } from 'formik';
import AddIcon from '@mui/icons-material/Add';
import BigNumber from 'bignumber.js';
import Row from '../Row';
import SelectionAccordion from '~/components/Common/Accordion/SelectionAccordion';

import useFarmerClaimPlantOptions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantOptions';
import ClaimPlantOptionCard from './ClaimPlantOptionCard';
import { ClaimAndPlantFormState } from '.';
import useToggle from '~/hooks/display/useToggle';
import useTimedRefresh from '~/hooks/app/useTimedRefresh';
import { ClaimPlantAction, ClaimPlantFormPresets } from '~/util/ClaimPlant';
import useClaimAndPlantActions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantActions';

type Props = {
  disabledActions?: {
    action: ClaimPlantAction;
    reason: string;
  }[];
}

type ClaimAndPlantGasResult = { [key in ClaimPlantAction]?: BigNumber };

const sortOrder: { [key in ClaimPlantAction]: number } = {
  [ClaimPlantAction.MOW]: 0,
  [ClaimPlantAction.PLANT]: 1,
  [ClaimPlantAction.ENROOT]: 2,
  [ClaimPlantAction.CLAIM]: 3,
  [ClaimPlantAction.HARVEST]: 4,
  [ClaimPlantAction.RINSE]: 5
};

const ClaimAndPlantAdditionalOptions: React.FC<Props> = ({
  disabledActions
}) => {
  const { actions } = useClaimAndPlantActions();
  /// State
  const [hovered, setHovered] = useState<Set<ClaimPlantAction>>(new Set());
  const [local, setLocal] = useState<Set<ClaimPlantAction>>(new Set());
  const [gasEstimates, setGasEstimates] = useState<ClaimAndPlantGasResult>({});
  const [open, show, hide] = useToggle();

  /// Helpers
  const { options: claimPlantOptions } = useFarmerClaimPlantOptions();

  /// Formik
  const { values: { farmActions }, setFieldValue } = useFormikContext<ClaimAndPlantFormState>();

  const { options, required, enabled, allToggled, disabled } = useMemo(() => {
    const preset = ClaimPlantFormPresets[farmActions.preset];

    const _options = [...preset.additional || []].sort((a, b) => sortOrder[a] - sortOrder[b]);

    const _required = new Set(preset.required.filter((opt) => claimPlantOptions[opt].enabled));

    const _disabled = new Map<ClaimPlantAction, string>(
      disabledActions?.map((datum) => [datum.action, datum.reason]) || []
    );

    const _enabled = _options.filter(
      (opt) => claimPlantOptions[opt].enabled && !_disabled.has(opt)
    );

    const _allToggled = _enabled.every(
      (action) => local.has(action) && !_disabled.has(action)
    ) && _enabled.length > 1;

    return {
      required: _required,
      options: _options,
      enabled: _enabled,
      allToggled: _allToggled,
      disabled: _disabled
    };
  }, [claimPlantOptions, disabledActions, farmActions.preset, local]);

  /// Handlers
  const handleOnToggle = (item: ClaimPlantAction) => {
    const copy = new Set([...local]);
    const affected = [item, ...claimPlantOptions[item].implied];

    if (copy.has(item)) {
      affected.forEach((v) => {
        if (!required.has(v)) {
          copy.delete(v);
        }
      });
    } else {
      affected.forEach((v) => {
        enabled.includes(v) && copy.add(v);
      });
    }

    setLocal(copy);
    setFieldValue('farmActions.additional', [...copy]);
  };

  const handleOnToggleAll = () => {
    const newSet = new Set([...(allToggled ? required : enabled)]);
    setLocal(newSet);
    setFieldValue('farmActions.additional', newSet);
  };

  const handleMouseEvent = (item: ClaimPlantAction, isRemoving: boolean) => {
    const copy = new Set([...hovered]);
    const affected = [item, ...claimPlantOptions[item].implied];
    if (isRemoving) {
      affected.forEach((option) => { 
        if (!required.has(option)) {
          copy.delete(option);
        }
      });
    } else {
      affected.forEach((option) => 
        enabled.includes(option) && !local.has && copy.add(option)
      );
    }
    if (copy.size !== hovered.size) {
      setHovered(copy);
    }
  };

  const estimateGas = useCallback(async () => {
    if (!enabled.length || !Object.keys(actions).length || !open) return;

    const optionKeys = [...enabled];
    const estimates = await Promise.all(
      optionKeys.map((opt) => actions[opt]().estimateGas())
    ).then((results) =>
      results.reduce<ClaimAndPlantGasResult>((prev, curr, i) => ({
        ...prev,
        [optionKeys[i]]: new BigNumber(curr.toString()),
      }), {})
    );

    setGasEstimates(estimates);
  }, [actions, enabled, open]);

  useTimedRefresh(estimateGas, 2 * 1000, open);

  // reset the local state if the form resets
  useEffect(() => {
    if (!options) {
      setLocal(new Set());
      setFieldValue('farmActions.additional', []);
    }
  }, [options, setFieldValue]);

  // update the local state to include required options
  useEffect(() => {
    if (!required.size) return;
    const hasAllRequired = [...required].every((opt) => local.has(opt));
    if (!hasAllRequired) {
      const updatedSelected = new Set([...local, ...required]);
      setLocal(updatedSelected);
      setFieldValue('farmActions.additional', [...updatedSelected]);
    }
  }, [local, required, setFieldValue]);

  // update local state if disable actions change
  useEffect(() => {
    if (!disabledActions) return;
    console.log('rendering...');
    const removeDisabled = () => {
      const filtered = new Set([...local]);
      disabledActions.forEach(({ action }) => {
        local.has(action) && filtered.delete(action);
      });

      if (filtered.size !== local.size) {
        setLocal(filtered);
        setFieldValue('farmActions.additional', [...filtered]);
      }
    };

    removeDisabled();
  }, [disabledActions, local, setFieldValue]);

  return (
    <SelectionAccordion<ClaimPlantAction>
      open={open}
      onChange={open ? hide : show}
      title={
        <Row gap={0.5}>
          <AddIcon fontSize="small" color="primary" />
          <Typography color="primary.main">
            Add additional transactions to save gas
          </Typography>
        </Row>
      }
      subtitle={
        <Row
          width="100%"
          justifyContent="space-between"
          // We add a negative margin b/c the MUI switch component has padding of 12px, and
          // removing the padding from the switch component causes unexpected behavior
          sx={{ my: '-12px', boxSizing: 'border-box' }}
        >
          <Typography color="text.secondary">Claim All</Typography>
          <Switch
            checked={allToggled}
            onClick={handleOnToggleAll}
            disabled={enabled.length <= 1}
          />
        </Row>
      }
      options={options}
      selected={local}
      onToggle={handleOnToggle}
      render={(item, selected) => (
        <ClaimPlantOptionCard
          option={item}
          disabled={disabled.has(item)}
          disabledMessage={disabled.get(item)}
          summary={claimPlantOptions[item]}
          selected={selected}
          required={required.has(item)}
          gas={gasEstimates[item] || undefined}
          isHovered={hovered.has(item)}
          onMouseOver={() => handleMouseEvent(item, false)}
          onMouseLeave={() => handleMouseEvent(item, true)}
        />
      )}
    />
  );
};

export default ClaimAndPlantAdditionalOptions;
