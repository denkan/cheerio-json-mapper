import fs from 'fs';
import path from 'path';
import { cheerioJsonMapper, Options, PipeFnMap } from '../src';

const customPipes: PipeFnMap = {
  onlyHttps: ({ value }) => value?.toString().replace(/^http:/, 'https:'),

  /** Check if all required props exists - and if not, set object to undefined  */
  requiredProps: ({ value, args }) => {
    // as this should be run as object pipe, value should be an object
    const obj = value as Record<string, unknown>;
    const requiredProps = args as string[];
    const missingProps = requiredProps.filter((prop) => obj && obj[prop] == null);
    if (missingProps.length > 0) {
      console.warn(`Object will be set to undefined due to missing required props (${missingProps.join(', ')}): `, obj);
      return undefined;
    }
    return obj;
  },

  /** Remove undefined/null from array property */
  cleanArray: ({ value, args }) => {
    // as this should be run as object pipe, value should be an object
    const obj = value as Record<string, unknown>;
    const prop = args?.[0] as string;
    const arr = (Array.isArray(obj[prop]) ? obj[prop] : []) as unknown[];
    obj[prop] = arr.filter((v: unknown) => v != null);
    return obj;
  },

  /** Replace object with sub-property value */
  replaceWithProp: ({ value, args }) => {
    // as this should be run as object pipe, value should be an object
    const obj = value as Record<string, unknown>;
    const prop = args?.[0] as string;
    return obj[prop];
  },
};

describe('cases', () => {
  const caseRootDir = path.join(__dirname, 'cases');
  const caseDirs = fs.readdirSync(caseRootDir);

  for (const caseDir of caseDirs) {
    const caseDirPath = path.join(caseRootDir, caseDir);
    const filePaths = {
      content: path.join(caseDirPath, 'content.html'),
      template: path.join(caseDirPath, 'template.json'),
      expected: path.join(caseDirPath, 'expected.json'),
    };
    const fileContents = {
      content: fs.readFileSync(filePaths.content, 'utf8'),
      template: fs.readFileSync(filePaths.template, 'utf8'),
      expected: fs.readFileSync(filePaths.expected, 'utf8'),
    };
    describe(`case [${caseDir}]`, () => {
      it('should return expected', () => {
        const options: Partial<Options> = {
          pipeFns: customPipes,
        };
        const r = cheerioJsonMapper(fileContents.content, fileContents.template, options);
        const expected = JSON.parse(fileContents.expected);
        expect(r).toEqual(expected);
      });
    });
  }
});
