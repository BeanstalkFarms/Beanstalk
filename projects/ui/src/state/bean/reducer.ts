import { combineReducers } from '@reduxjs/toolkit';

import pools from './pools/reducer';
import token from './token/reducer';
import unripe from './unripe/reducer';

export default combineReducers({
  pools,
  token,
  unripe,
});
