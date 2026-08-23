import { requestStatusText, requestTokenSymbol } from './requestDisplay';

describe('RFF request display', () => {
  it('shows the requested pending review copy with a useful expiry', () => {
    expect(requestStatusText('OPEN', 1_800, 0)).toBe(
      'Pending review · Expires in 30 min'
    );
    expect(requestStatusText('OPEN', 30 * 86_400, 0)).toBe(
      'Pending review · Expires in 30 days'
    );
  });

  it('uses clear lifecycle labels for non-open requests', () => {
    expect(requestStatusText('LOCKED', 1_000, 0)).toBe('Fill in progress');
    expect(requestStatusText('SAFE_PROPOSED', 1_000, 0)).toBe(
      'Awaiting multisig execution'
    );
    expect(requestStatusText('EXECUTED', 1_000, 0)).toBe('Filled');
    expect(requestStatusText('CANCELLED', 1_000, 0)).toBe('Cancelled');
    expect(requestStatusText('EXPIRED', 1_000, 0)).toBe('Expired');
  });

  it('labels only the two supported request tokens', () => {
    expect(
      requestTokenSymbol('0xBEA0005B8599265D41256905A9B3073D397812E4')
    ).toBe('BEAN');
    expect(
      requestTokenSymbol('0x5979D7b546E38E414F7E9822514be443A4800529')
    ).toBe('wstETH');
  });
});
