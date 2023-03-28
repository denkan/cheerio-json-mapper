import * as cheerio from 'cheerio';

type SingleOrArray<T> = T | T[];
export type JsonTemplateObject = { [prop: string]: JsonTemplateValue };
export type JsonTemplateValue = string | JsonTemplate;
export type JsonTemplate = SingleOrArray<JsonTemplateObject>;

export interface ResultWithPosition {
  result: unknown;
  position: Record<string, number>;
}

export interface PipeInput<T = unknown[]> {
  value?: unknown;
  selector?: string;
  $scope: cheerio.Cheerio<cheerio.AnyNode>;
  opts: Options;
  args?: T; // custom extra args sent to pipe
}
export type PipeFn = (input: PipeInput) => unknown | Promise<unknown>;
export type PipeFnMap = Record<string, PipeFn>;

export interface Pipe<T = unknown[]> {
  name: string;
  args?: T;
}

export interface Options {
  selectProp: string;
  pipeProp: string;
  pipeFns: PipeFnMap;
}

const defaultPipeFns: PipeFnMap = {
  text: ({ $scope, selector }) => $scope.find(selector).text().trim(),
  trim: ({ value }) => value?.toString().trim(),
  lower: ({ value }) => value?.toString().toLowerCase(),
  upper: ({ value }) => value?.toString().toUpperCase(),
  substr: ({ value, args }) => value?.toString().substring(+(args?.[0] || 0), +(args?.[1] || 0) || undefined),
  default: ({ value, args }) => value || args?.[0],
  parseAs: ({ value, args }) => {
    const type = args?.[0]?.toString().toLowerCase();
    const parseFns: Record<string, (v: string) => unknown> = {
      number: (v) => +v,
      int: (v) => parseInt(v, 10),
      float: parseFloat,
      bool: (v) => v?.toLowerCase() === 'true',
      date: Date.parse,
      json: JSON.parse,
      noop: (v) => v,
    };
    return parseFns[type || 'noop']((value || '').toString()) ?? value;
  },
  log: ({ value, args }) => {
    console.log(args?.[0], value);
    return value;
  },
  attr: ({ $scope, selector, args }) => {
    const attrName = args?.[0]?.toString() || '';
    return $scope.find(selector).attr(attrName)?.trim();
  },
};

const defaultOptions: Options = {
  selectProp: '$',
  pipeProp: '|',
  pipeFns: { ...defaultPipeFns },
};

export async function cheerioJsonMapper(
  htmlOrNode: string | cheerio.AnyNode | cheerio.Cheerio<cheerio.AnyNode>,
  jsonTemplate: string | JsonTemplate,
  options?: Partial<Options>,
) {
  if (typeof jsonTemplate === 'string') {
    jsonTemplate = JSON.parse(jsonTemplate);
  }

  const isCheerioNode =
    typeof htmlOrNode === 'object' && (htmlOrNode as cheerio.Cheerio<cheerio.AnyNode>).cheerio === '[cheerio object]';
  const $scope: cheerio.Cheerio<cheerio.AnyNode> = isCheerioNode
    ? (htmlOrNode as cheerio.Cheerio<cheerio.AnyNode>)
    : cheerio.load(htmlOrNode as never, { sourceCodeLocationInfo: true })(':root');

  const opts = { ...defaultOptions, ...options };
  opts.pipeFns = { ...defaultOptions.pipeFns, ...options?.pipeFns };

  if (Array.isArray(jsonTemplate)) {
    return mapArray($scope, jsonTemplate, opts);
  }
  if (typeof jsonTemplate === 'object' && jsonTemplate && !Array.isArray(jsonTemplate)) {
    const [{ result }] = await mapObject($scope, jsonTemplate, opts);
    return result; // return first matched
  }
}

/**
 * Map object template data
 **/
async function mapObject($scope: cheerio.Cheerio<cheerio.AnyNode>, jsonTemplate: JsonTemplateObject, opts: Options) {
  const scopeSelector = jsonTemplate[opts.selectProp] as string;
  const $subScope = scopeSelector ? $scope.find(scopeSelector) : $scope; // use $ selector if specified

  // a selector query can match multiple elements, so we need to loop over them
  const results: ResultWithPosition[] = [];

  for (let i = 0; i < $subScope.length; i++) {
    const $el = $subScope.eq(i);
    const result: Record<string, unknown> = {};
    const position: Record<string, number> = {};

    for (const key in jsonTemplate) {
      const templateValue = jsonTemplate[key];
      if (typeof templateValue === 'object' && templateValue) {
        result[key] = await cheerioJsonMapper($el, templateValue, opts); // recurse
      } else {
        const isInternalProp = [opts.selectProp, opts.pipeProp].includes(key);
        if (isInternalProp) {
          if (key === opts.selectProp) {
            // oh wait, we need to track position for selector prop!
            position[opts.selectProp] = $el[0]?.startIndex ?? 0;
          }
          continue; // dont do anything else with selector/pipe props here
        }
        const { value, startIndex } = await getValue(templateValue, $el, opts);
        result[key] = value; // set rendered value
        position[key] = startIndex ?? 0; // set position
      }
    }

    // apply pipes for object
    const pipesAsString = (jsonTemplate[opts.pipeProp] || '').toString().split('|');
    const pipes = parsePipes(pipesAsString);
    const pipedResults = await applyPipes(pipes, { value: result, $scope: $el, opts });

    results.push({
      result: pipedResults,
      position,
    });
  }

  return results;
}

/**
 * Map array template data
 */
async function mapArray($scope: cheerio.Cheerio<cheerio.AnyNode>, jsonTemplate: JsonTemplateObject[], opts: Options) {
  // loop over array and sort by matched startIndex
  const resultWithPositions: ResultWithPosition[] = [];
  for (const templateValue of jsonTemplate) {
    if (typeof templateValue === 'object' && templateValue) {
      // collect all matched items
      const items = await mapObject($scope, templateValue, opts);
      items.forEach((r) => resultWithPositions.push(r));
    } else {
      // literal (tuples)
      const { value, startIndex } = await getValue(templateValue, $scope, opts);
      resultWithPositions.push({ result: value, position: { _: startIndex || 0 } });
    }
  }
  const sortedResultWithPositions = resultWithPositions.sort((a, b) => {
    // sort by startIndex
    const startIndex = (x: ResultWithPosition) => x.position[opts.selectProp] ?? 0;
    return startIndex(a) - startIndex(b);
  });
  return sortedResultWithPositions.map((x) => x.result);
}

/**
 * Get value by either literal or selector through pipes
 */
async function getValue(
  templateValue: string | number | boolean,
  $scope: cheerio.Cheerio<cheerio.AnyNode>,
  opts: Options,
): Promise<{ value: unknown; startIndex?: number }> {
  const isHardValue = /(^".*"$)|(^'.*'$)/.test(templateValue.toString()); // e.g. "my hard value"
  if (isHardValue) {
    return { value: templateValue.toString().slice(1, -1) }; // remove quotes
  }
  if (typeof templateValue !== 'string') {
    return { value: templateValue }; // hardcoded number/boolean/null?
  }
  // use selector and run pipes
  const [selector, ...pipesAsString] = templateValue.split('|');
  const pipes = parsePipes(pipesAsString);
  if (pipes.length === 0) {
    pipes.push({ name: 'text' }); // use `text` as default pipe if nothing else specified
  }
  const result = await applyPipes(pipes, { selector, opts, $scope });
  const startIndex = $scope.find(selector)[0]?.startIndex ?? undefined;
  return { value: result, startIndex };
}

/**
 * Run pipes on selector
 */
async function applyPipes(pipes: Pipe[], initialInput: PipeInput) {
  const input: PipeInput = { ...initialInput };
  for (const pipe of pipes) {
    const pipeFn = input.opts.pipeFns[pipe.name];
    if (!pipeFn) {
      throw new Error(`Pipe function not found: ${pipe.name}`);
    }
    input.args = pipe.args;
    input.value = await pipeFn(input);
  }
  return input.value;
}

/**
 * Parse handler as string or object into ensured array of Pipe objects
 * @type {import('./scaper-mappers/types').ParseHandlerFn}
 */
export function parsePipes(pipeOrPipesAsStringOrObj: SingleOrArray<string | Pipe>): Pipe[] {
  // ensure array
  const pp = Array.isArray(pipeOrPipesAsStringOrObj) ? [...pipeOrPipesAsStringOrObj] : [pipeOrPipesAsStringOrObj];

  // ensure array of Handler objects
  const pipes = pp.map((p) => {
    if (typeof p === 'string' && p) {
      // parse string, e.g 'myFunc: myParam1; myParam2' => { name: 'markdown', args: ['myParam1','myParam2'] }
      const [name, ...argsStringArr] = p.split(':');
      const argsString = argsStringArr.join(':'); // re-join with ':' to allow for ':' in args
      const args = argsString.split(';').map((a) => a.trim());
      return {
        name: name.trim(),
        args: args.filter((a) => !!a),
      };
    }
    if (typeof p === 'object' && typeof p.name === 'string') {
      // already a Handler object
      p.args = p.args || [];
      return p;
    }
    // anything else is returned undefined and filtered out
    return;
  });
  const validPipes = pipes.filter((x) => !!x) as Pipe[];
  return validPipes;
}
