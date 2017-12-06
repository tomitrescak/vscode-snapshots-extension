# Luis (List of UIs)

[Luis](https://github.com/tomitrescak/luis) allows you to develop, test and **preview** your React components. It also gives you full power to **manage and view your saved snapshots** from Visual Studio Code. The Extension for Visual Studio Code comes with two awesome functionalities:

1. You can visualise current snapshot directly in Code environment. Just press `CMD + P` and search from `Luis: Snapshot Preview`. The snapshot will automatically load snapshots from the current test. This functionality works really well with automated test runner such as *wallabyjs*, or *mocha* or *jest* in watch test mode, and with snapshot delivery over TCP, since snapshots automatically change as you type. 

    ![luis](https://user-images.githubusercontent.com/2682705/32410567-ad66cb80-c217-11e7-9514-19232830aadd.gif)

2. You can work directly with a React component which is hot reloaded into your envirnment. Just press `CMD + P` and search from `Luis: Component Preview`. For this to work, you need to first run Luis (`npm start luis`). If you need to access the development console of the previewed component press `CMD + P` and search for `Luis: Show Componnt Dev Tools`. The previewed component automatically changes based on your selected test. The simplified interface provides following functionality:
    * See test result and test run time
    * Visualise the React component and manually test its functionality (great for development)
    * Visualise the difference between current component state and saved snapshot
    * Visualise the code difference between current component and snapshot
    * Update snapshot
    * Set automatic snapshot update with each hot reload

    ![luiscomponent](https://user-images.githubusercontent.com/2682705/32410656-5783c544-c21a-11e7-9b42-332705282ffa.gif)

<hr />
<div>Icons made by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>