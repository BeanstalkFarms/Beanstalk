import { getProposalTag, getProposalType } from '~/util/Governance';

describe('parsing', () => {
  const tag1 = getProposalTag(
    'BIP-32: Seraph'
  );
  const tag2 = getProposalTag('BFCP-A-4: Add sweetredbeans to the BFC');
  it('gets proposal tags', () => {
    expect(tag1).toBe('BIP-32');
    expect(tag2).toBe('BFCP-A-4');
  });
  it('gets proposal types', () => {
    expect(getProposalType(tag1)).toBe('BIP');
    expect(getProposalType(tag2)).toBe('BFCP-A');
  });
});
