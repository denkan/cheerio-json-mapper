// eslint-disable-next-line no-undef
module.exports = {
  'text-1': 'My text',
  'text-2': 'My text',
  trim: 'My untrimmed text',
  lower: 'my soon-to-be lower text',
  upper: 'MY SOON-TO-BE UPPER TEXT',
  'substr-1': 'fragmented text',
  'substr-2': 'fragmented',
  default: 'My default value',
  parseAs: {
    numbers: [
      { li: 123 }, //
      { li: 12.3 },
      { li: NaN },
      { li: NaN },
      { li: NaN },
    ],
    ints: [
      { li: 123 }, //
      { li: 12 },
      { li: 123 },
      { li: 12 },
      { li: NaN },
    ],
    floats: [
      { li: 123 }, //
      { li: 12.3 },
      { li: 123 },
      { li: 12.3 },
      { li: NaN },
    ],
    bools: [
      { li: true }, //
      { li: false },
      { li: false },
      { li: false },
      { li: false },
    ],
    dates: [
      { li: '2018-01-01T00:00:00.000Z' }, //
      { li: '2018-01-01T12:00:00.000Z' },
      { li: '2018-01-01T12:30:00.000Z' },
      { li: '2018-01-01T00:00:00.000Z' },
      { li: '2023-03-31T00:00:00.000Z' },
      { li: null },
      { li: null },
    ],
    jsons: [
      {
        li: {
          str: 'abc',
          num: 123,
          bool: true,
        },
      },
      { li: undefined },
    ],
    wrongs: [{ li: '123' }, { li: 'true' }, { li: 'whatever' }],
  },
};
