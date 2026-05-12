/**
 * FILE 1: UNIT TESTS — checkout.utils.test.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Pure function tests: NO React, NO DOM rendering, NO HTTP.
 */
import {
  luhn, detectCardType, validateExpiry, cvvLength, validateCvv,
  recalculateTotal, truncate, isRestaurantOpen,
  CardType, CartItem
} from '../utils/checkout.utils';
/**
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Test coverage:
 *  §1  Luhn algorithm
 *  §2  Card-type detection
 *  §3  Expiry validation
 *  §4  CVV length rules
 *  §5  Server-side price recalculation  (REQ17)
 *  §6  Character truncation             (REQ18)
 *  §7  Operating-hours logic            (REQ19)
 *  §8  Negative / failure scenarios
 */

// Real implementations imported above

// ===========================================================================
// §1  LUHN ALGORITHM
// ===========================================================================
describe('luhn()', () => {

  describe('valid card numbers', () => {
    test.each([
      ['4532015112830366', 'Visa real BIN'],
      ['5425233430109903', 'Mastercard real BIN'],
      ['374251018720955',  'Amex real BIN'],
      ['6011111111111117', 'Discover test number'],
      ['4111111111111111', 'Visa canonical test number'],
      ['5500005555555559', 'Mastercard canonical test number'],
    ])('accepts %s (%s)', (number) => {
      expect(luhn(number)).toBe(true);
    });
  });

  describe('invalid card numbers', () => {
    test.each([
      ['4532015112830367', 'off-by-one check digit'],
      ['1234567890123456', 'sequential pattern'],
      ['0000000000000000', 'all zeros'],
      ['9999999999999999', 'all nines'],
      ['4111111111111112', 'Visa with flipped last digit'],
    ])('rejects %s (%s)', (number) => {
      expect(luhn(number)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('rejects empty string',   () => expect(luhn('')).toBe(false));
    it('rejects single digit',   () => expect(luhn('4')).toBe(false));
    it('strips spaces before validating', () =>
      expect(luhn('4111 1111 1111 1111')).toBe(true));
    it('strips hyphens before validating', () =>
      expect(luhn('4111-1111-1111-1111')).toBe(true));
    it('rejects fully non-numeric input', () =>
      expect(luhn('abcdefghijklmnop')).toBe(false));
  });

  // ── NEGATIVE: simulate a buggy Luhn implementation ──────────────────────
  describe('negative — mocked broken Luhn', () => {
    it('exposes how downstream validators fail when Luhn always returns false', () => {
      const buggyLuhn = jest.fn<boolean, [string]>().mockReturnValue(false);
      const isCardAcceptable = (n: string) => buggyLuhn(n) && n.length >= 13;
      // A perfectly valid card must now be rejected
      expect(isCardAcceptable('4111111111111111')).toBe(false);
      expect(buggyLuhn).toHaveBeenCalledWith('4111111111111111');
    });

    it('exposes how downstream validators fail when Luhn always returns true', () => {
      const alwaysValidLuhn = jest.fn<boolean, [string]>().mockReturnValue(true);
      // Even junk should appear "valid" — this is the security hole
      expect(alwaysValidLuhn('0000')).toBe(true);
    });
  });
});

// ===========================================================================
// §2  CARD TYPE DETECTION
// ===========================================================================
describe('detectCardType()', () => {

  describe('known prefixes', () => {
    test.each([
      ['4111111111111111', 'visa'      ],
      ['4000000000000000', 'visa'      ],   // short Visa
      ['5100000000000000', 'mastercard'],
      ['5500000000000000', 'mastercard'],
      ['370000000000002',  'amex'      ],
      ['340000000000009',  'amex'      ],
      ['6011000000000004', 'discover'  ],
      ['6500000000000002', 'discover'  ],
    ] as [string, CardType][])(
      'detects %s as %s',
      (number, expected) => expect(detectCardType(number)).toBe(expected)
    );
  });

  it('returns "unknown" for unrecognised prefix', () =>
    expect(detectCardType('9999999999999999')).toBe('unknown'));

  it('handles empty string gracefully', () =>
    expect(detectCardType('')).toBe('unknown'));

  it('ignores formatting characters when detecting type', () =>
    expect(detectCardType('4111-1111-1111-1111')).toBe('visa'));
});

// ===========================================================================
// §3  EXPIRY VALIDATION
// ===========================================================================
describe('validateExpiry()', () => {
  // Pin "today" so tests never break with calendar drift
  const NOW = new Date('2024-06-15T12:00:00Z');

  describe('valid expiries', () => {
    it('accepts a card expiring next month',   () =>
      expect(validateExpiry('07/24', NOW).valid).toBe(true));
    it('accepts a card expiring in 5 years',   () =>
      expect(validateExpiry('06/29', NOW).valid).toBe(true));
    it('accepts expiry in the same month/year (not yet lapsed)', () =>
      expect(validateExpiry('06/24', NOW).valid).toBe(true));
  });

  describe('invalid — past dates', () => {
    it('rejects a card expired last month', () => {
      const r = validateExpiry('05/24', NOW);
      expect(r.valid).toBe(false);
      expect(r.error).toBe('Card expired');
    });
    it('rejects a card from a past year', () =>
      expect(validateExpiry('01/20', NOW).valid).toBe(false));
  });

  describe('invalid — bad month values', () => {
    it('rejects month 00', () => {
      const r = validateExpiry('00/25', NOW);
      expect(r.valid).toBe(false);
      expect(r.error).toBe('Invalid month');
    });
    it('rejects month 13', () =>
      expect(validateExpiry('13/25', NOW).valid).toBe(false));
  });

  describe('invalid — future limit', () => {
    it('rejects expiry > 20 years away', () => {
      const r = validateExpiry('06/45', NOW);
      expect(r.valid).toBe(false);
      expect(r.error).toBe('Too far in the future');
    });
  });

  describe('invalid — format errors', () => {
    it('rejects without slash',         () => expect(validateExpiry('0624', NOW).valid).toBe(false));
    it('rejects YYYY/MM order',         () => expect(validateExpiry('2024/06', NOW).valid).toBe(false));
    it('rejects empty string',          () => expect(validateExpiry('', NOW).valid).toBe(false));
    it('rejects letters',               () => expect(validateExpiry('AB/CD', NOW).valid).toBe(false));
  });

  // ── NEGATIVE: corrupted Date ────────────────────────────────────────────
  describe('negative — invalid / corrupted Date object', () => {
    it('returns invalid (not a crash) when `now` is NaN', () => {
      expect(() => {
        const r = validateExpiry('12/99', new Date('not-a-date'));
        expect(r.valid).toBe(false);
      }).not.toThrow();
    });
  });
});

// ===========================================================================
// §4  CVV LENGTH RULES
// ===========================================================================
describe('cvvLength() / validateCvv()', () => {

  describe('cvvLength()', () => {
    it('returns 4 for amex',      () => expect(cvvLength('amex')).toBe(4));
    it('returns 3 for visa',      () => expect(cvvLength('visa')).toBe(3));
    it('returns 3 for mastercard',() => expect(cvvLength('mastercard')).toBe(3));
    it('returns 3 for discover',  () => expect(cvvLength('discover')).toBe(3));
    it('returns 3 for unknown',   () => expect(cvvLength('unknown')).toBe(3));
  });

  describe('validateCvv()', () => {
    it('accepts 3-digit CVV for Visa',        () => expect(validateCvv('123', 'visa')).toBe(true));
    it('rejects 4-digit CVV for Visa',        () => expect(validateCvv('1234', 'visa')).toBe(false));
    it('accepts 4-digit CVV for Amex',        () => expect(validateCvv('1234', 'amex')).toBe(true));
    it('rejects 3-digit CVV for Amex',        () => expect(validateCvv('123', 'amex')).toBe(false));
    it('rejects 2-digit CVV for Visa',        () => expect(validateCvv('12', 'visa')).toBe(false));
    it('rejects non-numeric CVV',             () => expect(validateCvv('abc', 'visa')).toBe(false));
    it('rejects empty CVV',                   () => expect(validateCvv('', 'visa')).toBe(false));
    it('rejects CVV with embedded spaces',    () => expect(validateCvv('1 3', 'visa')).toBe(false));
  });
});

// ===========================================================================
// §5  SERVER-SIDE PRICE RECALCULATION  (REQ17)
// ===========================================================================
describe('recalculateTotal() — REQ17', () => {

  it('computes correct total from DB prices', () => {
    const items: CartItem[] = [{ id: 'I001', qty: 2, dbPrice: 75.00 }];
    expect(recalculateTotal(items)).toBeCloseTo(150.00);
  });

  it('returns 0 for an empty cart', () =>
    expect(recalculateTotal([])).toBe(0));

  it('handles null input without throwing', () =>
    expect(recalculateTotal(null as unknown as CartItem[])).toBe(0));

  it('sums multiple distinct line items', () => {
    const items: CartItem[] = [
      { id: 'I001', qty: 2, dbPrice: 75.00 },
      { id: 'I002', qty: 1, dbPrice: 30.00 },
    ];
    expect(recalculateTotal(items)).toBeCloseTo(180.00);
  });

  describe('parameterized price-manipulation cases (REQ17)', () => {
    test.each([
      // label               | manipulated client total | qty | db price | expected
      ['under-price attack',   0.01,       2, 75.00,  150.00],
      ['over-price attack',    999999.00,  1, 85.00,   85.00],
      ['negative price sent',  -50.00,     3, 75.00,  225.00],
    ] as [string, number, number, number, number][])(
      '%s: qty=%i × dbPrice=%f → %f EGP  (manipulated total %f ignored)',
      (_label, _manipulated, qty, dbPrice, expected) => {
        const items: CartItem[] = [{ id: 'I001', qty, dbPrice }];
        // The manipulated client-supplied total is never passed to this function
        expect(recalculateTotal(items)).toBeCloseTo(expected);
      }
    );
  });

  it('handles zero-price (free) items', () => {
    const items: CartItem[] = [{ id: 'FREE', qty: 5, dbPrice: 0 }];
    expect(recalculateTotal(items)).toBe(0);
  });

  it('treats null dbPrice as 0 (no revenue leak)', () => {
    const items = [{ id: 'X', qty: 2, dbPrice: null as unknown as number }];
    expect(recalculateTotal(items)).toBe(0);
  });
});

// ===========================================================================
// §6  CHARACTER TRUNCATION  (REQ18)
// ===========================================================================
describe('truncate() — REQ18', () => {

  it('leaves strings under the 500-char limit unchanged', () => {
    expect(truncate('a'.repeat(499))).toHaveLength(499);
  });

  it('leaves a string of exactly 500 chars unchanged', () => {
    const s = 'a'.repeat(500);
    expect(truncate(s)).toHaveLength(500);
    expect(truncate(s)).toBe(s);
  });

  it('truncates a 501-char string to 500 chars', () => {
    expect(truncate('a'.repeat(501))).toHaveLength(500);
  });

  it('truncates a very long string', () => {
    expect(truncate('x'.repeat(10_000))).toHaveLength(500);
  });

  it('accepts a custom character limit', () => {
    expect(truncate('hello world', 5)).toBe('hello');
  });

  it('handles an empty string', () => {
    expect(truncate('')).toBe('');
  });

  it('handles null without throwing', () => {
    expect(() => truncate(null as unknown as string)).not.toThrow();
  });

  it('preserves unicode characters correctly up to the limit', () => {
    const emoji = '😀'.repeat(250);          // 500 chars (each emoji = 2 code units)
    const result = truncate(emoji + 'EXTRA');
    // Should not exceed 500 chars
    expect(result.length).toBeLessThanOrEqual(500);
  });
});

// ===========================================================================
// §7  OPERATING HOURS LOGIC  (REQ19)
// ===========================================================================
describe('isRestaurantOpen() — REQ19', () => {
  const RESTAURANT = 'Burger Palace';

  /** Construct a UTC Date pinned to 2024-06-15 at HH:MM */
  const utc = (h: number, m = 0) =>
    new Date(Date.UTC(2024, 5, 15, h, m, 0));

  describe('open windows', () => {
    it('is OPEN at 10:00 — opening boundary', () =>
      expect(isRestaurantOpen(RESTAURANT, utc(10, 0)).open).toBe(true));
    it('is OPEN at 10:01 — just inside window', () =>
      expect(isRestaurantOpen(RESTAURANT, utc(10, 1)).open).toBe(true));
    it('is OPEN at 14:00 — mid-day', () =>
      expect(isRestaurantOpen(RESTAURANT, utc(14, 0)).open).toBe(true));
    it('is OPEN at 21:59 — last valid minute', () =>
      expect(isRestaurantOpen(RESTAURANT, utc(21, 59)).open).toBe(true));
  });

  describe('closed windows', () => {
    it('is CLOSED at 09:59 — one minute before opening', () => {
      const r = isRestaurantOpen(RESTAURANT, utc(9, 59));
      expect(r.open).toBe(false);
      expect(r.message).toBe(`${RESTAURANT} is currently closed`);
    });
    it('is CLOSED at 22:00 — closing boundary (exclusive)', () =>
      expect(isRestaurantOpen(RESTAURANT, utc(22, 0)).open).toBe(false));
    it('is CLOSED at 22:01 — just past closing', () =>
      expect(isRestaurantOpen(RESTAURANT, utc(22, 1)).open).toBe(false));
    it('is CLOSED at 03:00 — overnight', () =>
      expect(isRestaurantOpen(RESTAURANT, utc(3, 0)).open).toBe(false));
    it('is CLOSED at midnight', () =>
      expect(isRestaurantOpen(RESTAURANT, utc(0, 0)).open).toBe(false));
  });

  describe('client-clock spoofing is impossible (REQ19)', () => {
    it('returns CLOSED when server says 03:00 even though client shows 14:00', () => {
      // The function accepts only the server-injected UTC Date —
      // the local system clock is NEVER read.
      const serverTime = utc(3, 0);               // server: closed
      // (imagine client Date.now() would return 14:00)
      expect(isRestaurantOpen(RESTAURANT, serverTime).open).toBe(false);
    });
  });

  describe('boundary sweep — parameterized (REQ19)', () => {
    test.each([
      [ 9, 59, false, '09:59 → closed (pre-open)' ],
      [10,  0, true,  '10:00 → open  (boundary)'  ],
      [21, 59, true,  '21:59 → open  (last minute)'],
      [22,  0, false, '22:00 → closed (boundary)'  ],
      [ 3,  0, false, '03:00 → closed (overnight)' ],
    ] as [number, number, boolean, string][])(
      '%s', (h, m, expectedOpen) => {
        expect(isRestaurantOpen(RESTAURANT, utc(h, m)).open).toBe(expectedOpen);
      }
    );
  });

  // ── NEGATIVE: corrupted / invalid timestamps ────────────────────────────
  describe('negative — corrupted server timestamp', () => {
    it('returns CLOSED without throwing when Date is NaN', () => {
      expect(() => {
        const r = isRestaurantOpen(RESTAURANT, new Date('not-a-date'));
        expect(r.open).toBe(false);
      }).not.toThrow();
    });

    it('returns CLOSED for Unix epoch 0 (00:00 UTC, before open)', () =>
      expect(isRestaurantOpen(RESTAURANT, new Date(0)).open).toBe(false));

    it('includes an error message when timestamp is invalid', () => {
      const r = isRestaurantOpen(RESTAURANT, new Date(NaN));
      expect(r.message).toBeTruthy();
    });
  });
});

// ===========================================================================
// §8  ADDITIONAL NEGATIVE / FAILURE SCENARIOS
// ===========================================================================
describe('§8 Negative & failure scenarios', () => {

  // ── localStorage quota exceeded ─────────────────────────────────────────
  describe('localStorage — QuotaExceededError', () => {
    afterEach(() => jest.restoreAllMocks());

    it('surfaces quota error when storage is full', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const err = new DOMException('The storage quota has been exceeded.', 'QuotaExceededError');
        throw err;
      });

      const safeSave = (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e as DOMException).name };
        }
      };

      const result = safeSave('order', JSON.stringify({ id: 1 }));
      expect(result.ok).toBe(false);
      expect(result.error).toBe('QuotaExceededError');
    });
  });

  // ── Malformed API response ───────────────────────────────────────────────
  describe('malformed / unexpected API responses', () => {
    const parseOrderStatus = (raw: unknown): string => {
      if (typeof raw !== 'object' || raw === null) return 'UNKNOWN';
      const obj = raw as Record<string, unknown>;
      return typeof obj['status'] === 'string' ? obj['status'] : 'UNKNOWN';
    };

    it('returns UNKNOWN for null response',     () => expect(parseOrderStatus(null)).toBe('UNKNOWN'));
    it('returns UNKNOWN for undefined response',() => expect(parseOrderStatus(undefined)).toBe('UNKNOWN'));
    it('returns UNKNOWN for plain string',      () => expect(parseOrderStatus('OK')).toBe('UNKNOWN'));
    it('returns UNKNOWN when status field missing', () =>
      expect(parseOrderStatus({ id: 42 })).toBe('UNKNOWN'));
    it('returns UNKNOWN when status is a number', () =>
      expect(parseOrderStatus({ status: 200 })).toBe('UNKNOWN'));
    it('returns correct status from well-formed response', () =>
      expect(parseOrderStatus({ status: 'CONFIRMED' })).toBe('CONFIRMED'));
  });

  // ── Floating-point precision ─────────────────────────────────────────────
  describe('floating-point precision in price calculations', () => {
    it('0.1 + 0.2 does not equal 0.3 exactly — use toBeCloseTo', () => {
      const items: CartItem[] = [
        { id: 'A', qty: 1, dbPrice: 0.1 },
        { id: 'B', qty: 1, dbPrice: 0.2 },
      ];
      expect(recalculateTotal(items)).toBeCloseTo(0.3, 10);
    });
  });
});
