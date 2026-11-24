import { createHmac } from 'node:crypto';
import { decimal, saspaySignatureValid } from './saspay';

describe('SasPay', () => {
  const secret = 'whsec_test';
  const body = Buffer.from(
    '{"event":"transaction.success","data":{"id":"t1"}}',
  );
  const sign = (ts: string, raw = body) =>
    createHmac('sha256', secret)
      .update(`${ts}.${raw.toString()}`)
      .digest('hex');

  it('signature valide sur « horodatage.corps brut »', () => {
    expect(saspaySignatureValid(body, sign('1000'), '1000', secret, 1000)).toBe(
      true,
    );
  });

  it('rejette un corps modifié, un mauvais secret, une signature absente', () => {
    const other = Buffer.from(body.toString().replace('t1', 't2'));
    expect(
      saspaySignatureValid(other, sign('1000'), '1000', secret, 1000),
    ).toBe(false);
    expect(
      saspaySignatureValid(body, sign('1000'), '1000', 'autre', 1000),
    ).toBe(false);
    expect(saspaySignatureValid(body, undefined, '1000', secret, 1000)).toBe(
      false,
    );
  });

  it('rejette un horodatage de plus de 300 s ou invalide', () => {
    expect(saspaySignatureValid(body, sign('1000'), '1000', secret, 1300)).toBe(
      true,
    );
    expect(saspaySignatureValid(body, sign('1000'), '1000', secret, 1301)).toBe(
      false,
    );
    expect(saspaySignatureValid(body, sign('1000'), '1000', secret, 699)).toBe(
      false,
    );
    expect(saspaySignatureValid(body, sign('abc'), 'abc', secret, 1000)).toBe(
      false,
    );
    expect(
      saspaySignatureValid(body, sign('1000'), undefined, secret, 1000),
    ).toBe(false);
  });

  it('montant en chaîne décimale', () => {
    expect(decimal(2500)).toBe('2500.00');
  });
});
