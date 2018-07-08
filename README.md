# LUIS (List of UIs) helpers for Visual Studio Code

[Luis](https://github.com/tomitrescak/luis) allows you to develop, test and **preview** your React components. It also gives you full power to **view your saved snapshots as well as view live preview of currently rendered snapshots** from Visual Studio Code. The Extension for Visual Studio Code comes with two awesome functionalities:

## Live Snapshot Preview

You can visualise current snapshot directly in Code environment. Just press `CMD + P` and search from `Luis: View Live snapshots`. The snapshot will automatically load snapshots from the current test.

![luis](https://user-images.githubusercontent.com/2682705/42417411-0ce16f40-82cd-11e8-90e5-cc601e34149f.gif)

To make this work you need to do following:

1.  In your project `yarn add jest-spy-serialiser`
2.  In your jest startup file, e.g. jest.config.js just insert following `require('jest-spy-serialiser').registerSpy()`;
3.  Profit

## Stored Snapshot Preview

You can view all snapshots that are stored in your project folder. Just press `CMD + P` and search from `Luis: View Stored snapshots`.

![luis](https://user-images.githubusercontent.com/2682705/42417444-ccc77f98-82cd-11e8-9423-c62b01bf8e4e.gif)

<hr />
<div>Icons made by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>

## UI Frameworks and extra CSS

## Styled Components

In case you are using `styled-components` and you want to render also their styles, you need to hack a bit including following. In your test file:

```
import 'jest-styled-components'
```

And in your jest startup file (until [this](https://github.com/styled-components/jest-styled-components/issues/135) is resolved):

```js
const css = require('css');
const stringify = css.stringify;

css.stringify = ast => {
  let result = stringify(ast);
  result = `<style>\n${result}</style>`;
  return result;
};
```
