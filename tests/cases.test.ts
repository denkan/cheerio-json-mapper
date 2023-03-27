import fs from 'fs';
import path from 'path';
import { cheerioJsonMapper } from '../src';

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
        const expected = JSON.parse(fileContents.expected);
        const r = cheerioJsonMapper(fileContents.content, fileContents.template);
        expect(r).toEqual(expected);
      });
    });
  }
});
