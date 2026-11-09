import { describe, expect, it } from 'vitest';
import { formatInches, formatLength, inch, parseLength } from './units';

describe('parseLength', () => {
  it.each([
    ['1-5/8', 41.275],
    ['1 5/8"', 41.275],
    ['5/8 in', 15.875],
    ['1.5', 38.1],
    ['.5', 12.7],
    ['24"', 609.6],
    ['38mm', 38],
    ['3.8 cm', 38],
  ])('reads %s', (text, mm) => {
    expect(parseLength(text)).toBeCloseTo(mm, 6);
  });

  it('treats a bare number as the default unit', () => {
    expect(parseLength('40', 'mm')).toBe(40);
    expect(parseLength('2', 'in')).toBeCloseTo(50.8, 6);
  });

  it.each(['', 'abc', '1/0', '-3', '1-5/8 feet'])('rejects %j', (text) => {
    expect(() => parseLength(text)).toThrow();
  });
});

describe('formatInches', () => {
  it.each([
    [inch(1.625), '1-5/8"'],
    [inch(0.75), '3/4"'],
    [inch(12), '12"'],
    [inch(1.375), '1-3/8"'],
    [inch(0.03125), '1/32"'],
    [0, '0"'],
  ])('writes %d mm as %s', (mm, text) => {
    expect(formatInches(mm)).toBe(text);
  });

  it('rounds to the nearest 1/32 and carries into the whole number', () => {
    expect(formatInches(inch(1.99))).toBe('2"');
    expect(formatInches(inch(1.51))).toBe('1-1/2"');
  });

  it('formats metric to a tenth of a millimetre', () => {
    expect(formatLength(41.275, 'mm')).toBe('41.3 mm');
  });
});
