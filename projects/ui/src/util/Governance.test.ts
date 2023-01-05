import { getProposalTag, getProposalType } from '~/util/Governance';

describe('parsing', () => {
  const tag1 = getProposalTag('BSP-7: Fund Bean Portion of the Six-Month Halborn Retainer');
  const tag2 = getProposalTag('BFCP-A-4: Add sweetredbeans to the BFC');
  it('gets proposal tags', () => {
    expect(tag1).toBe('BSP-7');
    expect(tag2).toBe('BFCP-A-4');
  });
  it('gets proposal types', () => {
    expect(getProposalType(tag1)).toBe('BSP');
    expect(getProposalType(tag2)).toBe('BFCP-A');
  });
});
