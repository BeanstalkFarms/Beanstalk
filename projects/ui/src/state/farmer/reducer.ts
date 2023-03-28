import { combineReducers } from '@reduxjs/toolkit';

import allowances from './allowances/reducer';
import balances from './balances/reducer';
import barn from './barn/reducer';
import events2 from './events2/reducer';
import field from './field/reducer';
import market from './market/reducer';
import silo from './silo/reducer';

export default combineReducers({
  allowances,
  balances,
  barn,
  events2,
  field,
  market,
  silo,
});
