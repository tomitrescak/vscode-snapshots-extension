//@ts-ignore
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { HtmlProvider, noTests } from './html_provider';
import { StaticTextExtractor } from '../utils/static_text_extractor';
import { formatSnapshot } from '../utils/format';
import { startServer } from '../utils/json_server';

export class SnapshotContentProvider extends HtmlProvider
  implements vscode.TextDocumentContentProvider {
  cache = {};
  publicPath = path.join(vscode.workspace.rootPath, 'public');
  lastFile = '';

  constructor(extractor: StaticTextExtractor, uri: any) {
    super(extractor, uri);
    // start watching file system
    // let rootPath = path.join(vscode.workspace.rootPath, 'src', 'tests', 'snapshots', '**');
    // let watcher = vscode.workspace.createFileSystemWatcher(rootPath);

    // watcher.onDidChange(this.filesChanged);
    // watcher.onDidCreate(this.filesChanged);
    // watcher.onDidDelete(this.filesChanged);

    // startServer(message => {
    //   const file = message.file;
    //   const content = message.content;

    //   if (file.match(/.css/)) {
    //     this.cache[file] = this.parseStyles(content.styles);
    //     return;
    //   }

    //   this.cache[file] = content;
    //   this.readFile();
    // });

    extractor.watchPath = this.watchPath;
  }

  private parseStyles(styles: string) {
    return styles.replace(
      /: *'?url\("?\/?([\/\w\._]*)"?\)'?/g,
      `: url('file://${this.publicPath}/$1')`
    );
  }

  watchPaths = {};
  private watchPath = (watchPath: string) => {
    if (this.filesChanged && !this.watchPaths[watchPath]) {
      let watcher = vscode.workspace.createFileSystemWatcher(path.join(watchPath, '**'));

      watcher.onDidChange(this.filesChanged);
      watcher.onDidCreate(this.filesChanged);
      watcher.onDidDelete(this.filesChanged);

      this.watchPaths[watchPath] = watcher;
    }
  };

  private filesChanged = (e: any) => {
    this.readFile(false);
    return { dispose() {} };
  };

  public readFile(useCache = true) {
    const { snapshotPath, rootPath, snapshotNames, testName, folders } = this.extractor;

    if (!snapshotPath || !testName) {
      this.snapshots = noTests;
      return;
    }

    let adjustedPath = snapshotPath.replace(/@[^_\.-]+/g, '');
    let styleName = path.parse(path.parse(adjustedPath).name).name + '.css';

    if (useCache) {
      if (this.lastFile == testName) {
        return;
      }
      this.lastFile = testName;
      if (this.cache[adjustedPath]) {
        // style name

        return this.updateFile(
          rootPath,
          this.cache[adjustedPath],
          this.cache[styleName],
          snapshotNames,
          folders,
          testName
        );
      }
    }
    this.lastFile = testName;

    // read custom styles
    let stylePath = path.join(rootPath, styleName);
    let storedStyles = '';
    try {
      fs.statSync(stylePath);
      storedStyles = fs.readFileSync(stylePath, { encoding: 'utf-8' });
      storedStyles = this.parseStyles(storedStyles);
      this.cache[styleName] = storedStyles;
    } catch {}

    try {
      let stats = fs.statSync(adjustedPath);
    } catch (ex) {
      this.snapshots = 'There are no snapshots for: ' + adjustedPath;
      return;
    }

    // remove tags

    // let file = fs.readFileSync(adjustedPath, { encoding: 'utf-8' });
    delete require.cache[adjustedPath];
    let ss = require(adjustedPath);

    // add to cache
    this.cache[adjustedPath] = ss;

    return this.updateFile(rootPath, ss, storedStyles, snapshotNames, folders, testName);
  }

  public updateFile(
    rootPath: string,
    ss: any,
    styles: string,
    snapshotNames: string[],
    folders: string[],
    testName: string
  ) {
    const result = formatSnapshot(ss, this.publicPath, snapshotNames, styles);

    this.extractor.lastSnapshots = result;
    this.extractor.lastFolders = folders;
    this.extractor.lastTest = testName;
    this.extractor.lastSnapshotNames = snapshotNames;
    this.extractor.lastFileName = vscode.window.activeTextEditor.document.fileName;

    this.snapshots = result;

    if (vscode.workspace.getConfiguration('snapshots').get('saveHtml')) {
      fs.writeFileSync(path.join(rootPath, 'output.html'), result);
    }

    return result;
  }

  // private frame(uri: string) {
  // 	return `<style>iframe { background-color: white } </style>
  // 	<iframe src="${uri}" frameBorder="0" width="100%" height="1000px" />`;
  // }
}
