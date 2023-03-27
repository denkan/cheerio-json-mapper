module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  rootDir: 'tests',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec|e2e))\\.(t|j)s$',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};
