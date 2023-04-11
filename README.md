# Cheerio JSON Mapper

Extract HTML markup to JSON using [Cheerio](https://cheerio.js.org/).

---

<!-- ![Build Status]() -->

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![npm version](https://badge.fury.io/js/cheerio-json-mapper.svg)](https://badge.fury.io/js/cheerio-json-mapper)

## Install

```sh
# npm
npm i -S cheerio-json-mapper

# yarn
yarn add cheerio-json-mapper
```

## Usage

```js
import { cheerioJsonMapper } from 'cheerio-json-mapper';

const html = `
    <article>
        <h1>My headline</h1>
        <div class="content">
            <p>My article text.</p>
        </div>
        <div class="author">
            <a href="mailto:john.doe@example.com">John Doe</a>
        </div>
    </article>
`;

const template = {
  headline: 'article > h1',
  articleText: 'article > .content',
  author: {
    $: 'article > .author',
    name: '> a',
    email: '> a | attr:href | substr:7',
  },
};

const result = await cheerioJsonMapper(html, template);
console.log(result);
// output:
// {
//     headline: "My headline",
//     articleText: "My article text.",
//     author: {
//         name: "John Doe",
//         email: "john.doe@example.com"
//     }
// }
```

More examples are found in [the repo's tests/cases folder](https://github.com/denkan/cheerio-json-mapper/tree/master/tests/cases).

## Core concepts

- [End-Result Structure First](#end-result-structure-first)
- [Scoping](#scoping)
- [Pipes](#pipes)

### End-Result Structure First

The main approach is to start from what we need to retrieve. Defining the end structure and just telling each property which _selector_ to use to get its value.

#### Hard-coded values (literals)

We can set hard values to the structure by wrapping strings in quotes or single-quotes. Numbers and booleans are automatically detected as literals:

```json
{
  "headline": "article > h1",
  "public": true,
  "copyright": "'© Copyright Us Inc. 2023'",
  "version": 1.23
}
```

### Scoping

Large documents with nested parts tend to require big and ugly selectors. To simplify things, we can _scope_ an object to only care for a certain selected part.

Add a `$` property with selector to narrow down what the rest of the object should use as base.

Example:

```html
<article>
  <h1>My headline</h1>
  <div class="content">
    <p>My article text.</p>
  </div>
  <div class="author">
    <span class="name">John Doe</span>
    <span class="tel">555-1234</span>
    <a href="mailto:john.doe@example.com">John Doe</a>
  </div>
  <div class="other">
    <span class="name">This wont be selected due to scoping</span>
  </div>
</article>
```

```js
const template = {
  $: 'article',
  headline: '> h1',
  articleText: '> .content',
  author: {
    $: '> .author',
    name: 'span.name',
    telephone: 'span.tel',
    email: 'a[href^=mailto:] | attr:href | substr:7',
  },
};
```

#### Self-selector

In some cases we want to reuse the object selector (`$`) for a property selector. Especially handy when targeting lists, e.g. this case:

```js
const html = `
  <ul>
    <li>One</li>
    <li>Two</li>
    <li>Three</li>
  </ul>
`;
const template = [
  {
    $: 'ul > li',
    value: '$', // uses `ul > li` as property selector
  },
];
const result = await cheerioJsonMapper(html, template);
console.log(result);
// Output:
// [
//   { value: 'One' },
//   { value: 'Two' },
//   { value: 'Three' }
// ];
```

> Note: Don't like the `$` name for scope selector? Change it through options: `cheerioJsonMapper(html, template, { scopeProp: '__scope' }): `

### Pipes

Sometimes the text content of a selected node is not what we need. Or not enough. **_Pipes_ to rescue!**

Pipes are functionality that can be applied to a value - both a property selector and an object. Use pipes to handle any custom needs.

Multiple pipes are supported (seperated by `|` char) and will run in sequence. Do note that value returned from a pipe will be passed to next pipe, allowing us to chain functionality (kind of same way as \*nix terminal pipes, which was the inspiration to this syntax).

Pipes can have basic arguments by adding colon (`:`) along with semi-colon (`;`) seperated values.

Pipes can by asynchronous.

#### Use pipes in selector props:

```js
{
  email: 'a[href^=mailto:] | attr:href | substr:7';
}
```

### Use pipes in objects:

```js
{
    name: 'span.name',
    email: 'a[href^=mailto:] | attr:href | substr:7',
    telephone: 'span.tel',
    '|': 'requiredProps:name;email'
}
```

> Note: Don't like the `|` name for pipe property? Change it through options: `cheerioJsonMapper(html, template, { pipeProp: '__pipes' }): `

#### Default pipes included:

- `text` - grab `.textContent` from selected node (used default if no other pipes are specified)
- `trim` - trim grabbed text
- `lower` - turn grabbed text to lower case
- `upper` - turn grabbed text to upper case
- `substr` - get substring of grabbed text
- `default` - if value is nullish/empty, use specified fallback value
- `parseAs` - parse a string to different types:
  - `parseAs:number` - number
  - `parseAs:int` - integer
  - `parseAs:float` - float
  - `parseAs:bool` - boolean
  - `parseAs:date` - date
  - `parseAs:json` - JSON
- `log` - will console.log current value (use for debugging)
- `attr` - get attribute value from selected node

#### Custom pipes

Create your own pipes to handle any customization needed.

```js
const customPipes = {
  /** Replace any http:// link into https:// */
  onlyHttps: ({ value }) => value?.toString().replace(/^http:/, 'https:'),

  /** Check if all required props exists - and if not, set object to undefined  */
  requiredProps: ({ value, args }) => {
    const obj = value; // as this should be run as object pipe, value should be an object
    const requiredProps = args; // string array
    const hasMissingProps = requiredProps.some((prop) => obj[prop] == null);
    return hasMissingProps ? undefined : obj;
  },
};

const template = [
  {
    name: 'span.name',
    telephone: 'span.tel',
    email: 'a[href^=mailto:] | attr:href | substr:7',
    website: 'a[href^=http] | attr:href | onlyHttps',
    '|': 'requiredProps:name;email',
  },
];

const contacts = await cheerioJsonMapper(html, template, { pipeFns: customPipes });
```

## Examples

More examples are found in [the repo's tests/cases folder](https://github.com/denkan/cheerio-json-mapper/tree/master/tests/cases).

## Change Log

### v1.0.3 - 2023-04-11

- Fixed bug with getScope() method.

### v1.0.2 - 2023-04-04

- Fixed bug when scoped object selectors doesn't match anything.
- Support [self-selector](#self-selector).
- Align how default pipes should behave.

### v1.0.1 - 2023-03-28

- Updated README

### v1.0.0 - 2023-03-28

- First release with initial functionality;
  - End-result structure first approach
  - Scoping
  - Pipes with default setup of pipe funcs
