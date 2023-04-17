import { useSelector } from 'react-redux';
import { AppState } from '~/state';

const usePrice = () => useSelector<AppState, AppState['_bean']['token']['price']>((state) => state._bean.token.price);

export default usePrice;
