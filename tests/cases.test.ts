/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { cheerioJsonMapper, JsonTemplate, PipeFnMap } from '../src';

const customPipes: PipeFnMap = {
  /** Replace any http:// link into https:// */
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

  /** Async pipe proof of concept */
  dummyDelay: async ({ value, args }) => {
    const delay = +(args?.[0] || 0) || (0 as number);
    console.time('dummyDelay');
    console.timeLog('dummyDelay', `Started for ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    console.timeEnd('dummyDelay');
    return value;
  },

  /** Transform root object into desired list structure */
  transformTable: ({ value }) => {
    // `value` = root object
    const isValid = typeof value === 'object' && value;
    if (!isValid) {
      return value;
    }
    const tableObj = value as { rows: Array<{ cols: Array<{ value: string }> }> };
    const headers = tableObj.rows[0].cols.map((h) => h.value); // e.g ["Name", "Age"]
    const rows = tableObj.rows.slice(1); // skip header row
    const resultList = rows.map((row) => {
      const resultItem: Record<string, string> = {};
      headers.forEach((headerText, i) => {
        resultItem[headerText] = row.cols[i].value;
      });
      return resultItem;
    });
    return resultList;
  },
};

describe('cases', () => {
  const caseRootDir = path.join(__dirname, 'cases');
  const caseDirs = fs.readdirSync(caseRootDir);

  for (const caseDir of caseDirs) {
    const caseDirPath = path.join(caseRootDir, caseDir);
    const { content, template, expected } = getTestCase(caseDirPath);

    describe(`case [${caseDir}]`, () => {
      it('should have content as string', () => {
        expect(content).toBeDefined();
        expect(typeof content).toBe('string');
      });
      it('should have template as object', () => {
        expect(template).toBeDefined();
        expect(typeof template).toBe('object');
      });
      it('should have expected as object', () => {
        expect(expected).toBeDefined();
        expect(typeof expected).toBe('object');
      });
      it('should resolve expected', async () => {
        const r = await cheerioJsonMapper(content, template, { pipeFns: customPipes });
        expect(r).toEqual(expected);
      });
    });
  }
});

interface TestCase {
  content: string;
  template: string | JsonTemplate;
  expected: unknown;
}

function getTestCase(caseDirPath: string): TestCase {
  const filePaths = {
    content: path.join(caseDirPath, 'content.html'),
    template: {
      js: path.join(caseDirPath, 'template.js'),
      json: path.join(caseDirPath, 'template.json'),
    },
    expected: {
      js: path.join(caseDirPath, 'expected.js'),
      json: path.join(caseDirPath, 'expected.json'),
    },
  };
  const jsOrJson = (x: { js: string; json: string }) => {
    if (fs.existsSync(x.js)) {
      return require(x.js);
    } else {
      return JSON.parse(fs.readFileSync(x.json, 'utf8'));
    }
  };
  return {
    content: fs.readFileSync(filePaths.content, 'utf8'),
    template: jsOrJson(filePaths.template),
    expected: jsOrJson(filePaths.expected),
  };
}
