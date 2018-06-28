# LUIS (List of UIs) helper for Visual Studio Code

[Luis](https://github.com/tomitrescak/luis) allows you to develop, test and **preview** your React components. It also gives you full power to **manage and view your saved snapshots** from Visual Studio Code. The Extension for Visual Studio Code comes with two awesome functionalities:

## Live Snapshot Preview

You can visualise current snapshot directly in Code environment. Just press `CMD + P` and search from `Luis: Snapshot Preview`. The snapshot will automatically load snapshots from the current test.

![luis](https://user-images.githubusercontent.com/2682705/32410567-ad66cb80-c217-11e7-9514-19232830aadd.gif)

IDEA: This functionality works really well with automated test runner such as _wallabyjs_, or _mocha_ or _jest_ in watch test mode. For jest, run with `jest --updateSnapshot --watchAll` and the snapshot will reload after each save.

## Live Component Preview

You can work directly with a React component which is hot reloaded into your environment. Just press `CMD + P` and search from `Luis: Component Preview`. For this to work, you need to first run Luis (`npm start luis`). If you need to access the development console of the previewed component press `CMD + P` and search for `Luis: Show Componnt Dev Tools`. The previewed component automatically changes based on your selected test. The simplified interface provides following functionality:
_ See test result and test run time
_ Visualise the React component and manually test its functionality (great for development)
_ Visualise the difference between current component state and saved snapshot
_ Visualise the code difference between current component and snapshot
_ Update snapshot
_ Set automatic snapshot update with each hot reload

![luiscomponent](https://user-images.githubusercontent.com/2682705/32410656-5783c544-c21a-11e7-9b42-332705282ffa.gif)

## Update Snapshots

If you are not running jest or mocha, you can update your snapshots from `CMD + P`, finding `LUIS: Update Snapshot`. For this functionality, you need to define the command in your user/workspace settings, to execute with your test environment.

Example for Jest:

```
"snapshots.updateFileCommand": "jest -u -t '$1'",
"snapshots.updateTestCommand": "jest -u -t '$1'"
```

Example for Mocha with [chai-match-snapshot](https://github.com/tomitrescak/chai-match-snapshot) component:

```
"snapshots.updateFileCommand": "US=drive ./node_modules/.bin/mocha --exit --grep '$1' --ui snapshots '$2' -P",
"snapshots.updateTestCommand": "US=drive ./node_modules/.bin/mocha --exit --grep '$1' --ui snapshots '$2' -P"
```

<hr />
<div>Icons made by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>
