/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';

const noTests = `<div>No test found!</div>`;

const html = `<!DOCTYPE html>
<html>

<head>
    <title></title>
</head>

<body style="background: transparent; background-image: none!important">
    <link href='http://fonts.googleapis.com/css?family=Lato:400,700' rel='stylesheet' type='text/css'>
    <link href='https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.13/semantic.min.css' rel='stylesheet' type='text/css'>
		$style
		<div style="background: white">
		$body
		</div>
</body>

</html>`;

let lastFileName = null;
let lastTest = null;
let lastSnapshots = null;
let lastSnapshotNames = null;
let lastFolders = null;

export function activate(context: vscode.ExtensionContext) {
  let snapshotPreviewUri = vscode.Uri.parse('snapshot-preview://authority/snapshot-preview');
  let componentPreviewUri = vscode.Uri.parse('component-preview://authority/component-preview');

  class StaticTextExtractor {
    testName: string;
    rootPath: string;
    snapshotPath: string;
    folders: string[];
    snapshotNames: string[];
    storyId: string;
    lastFileName: string;

    private testWordAtPosition(text: string, word: string, position: number) {
      if (text[position] !== "'") {
        return;
      }
      // if (!text[position-1].match(/\S/)) {
      //   return;
      // }

      let currentPosition = position;
      for (let i = 0; i < word.length; i++) {
        while (text[currentPosition] != null && text[currentPosition].match(/\s/)) {
          currentPosition--;
        }
        if (text[currentPosition] != word[word.length - i - 1]) {
          return false;
        }
        currentPosition--;
      }
      return true;
    }

    private extractText(text: string, position: number) {
      let name = '';
      let quote = text[position] === '"' ? '"' : "'";

      while (text[position] != null && text[position] != quote) {
        if (text[position] == '\\') {
          position += 2;
          continue;
        }
        name += text[position];
        position++;
      }
      return name;
    }

    private findMatchingBracket(
      text: string,
      position: number,
      openBracket = '{',
      closeBracket = '}',
      increment = -1
    ) {
      let brackets = 1;
      while (text[position] != undefined && brackets > 0) {
        if (text[position] === openBracket) {
          brackets--;
        } else if (text[position] === closeBracket) {
          brackets++;
        }
        position += increment;
      }
      return position;
    }

    private extractPaths(
      text: string,
      contextStart: number,
      contextEnd: number
    ): { testName: string; folders?: string[]; snapshots?: string[] } {
      let testName = null;
      let folders = [];
      let preview = null;

      let testStart = null;
      let testEnd = null;

      for (let i = contextStart; i >= 0; i--) {
        if (!testName) {
          if (
            this.testWordAtPosition(text, "it('", i) ||
            this.testWordAtPosition(text, "itMountsAnd('", i) ||
            this.testWordAtPosition(text, "itMountsContainerAnd('", i)
          ) {
            testName = this.extractText(text, i + 1);
            testStart = i;
            testEnd = this.findMatchingBracket(text, i, ')', '(', 1);
          }
        }
        if (testName) {
          if (
            this.testWordAtPosition(text, "describe('", i) ||
            this.testWordAtPosition(text, "storyOf('", i)
          ) {
            folders.push(this.extractText(text, i + 1));
            i = this.findMatchingBracket(text, i);
          }
        }
      }

      let snapshots: string[] = null;

      if (testName) {
        snapshots = this.extractSnapshotNames(text, testStart, testEnd);
        snapshots.push(testName);
      }

      return {
        testName,
        folders: folders.reverse(),
        snapshots
      };
    }

    private extractSnapshotNames(text: string, contextStart: number, contextEnd: number) {
      let names = [];
      for (let i = contextEnd; i >= contextStart; i--) {
        if (this.testWordAtPosition(text, "matchSnapshot('", i)) {
          names.push(this.extractText(text, i + 1));
        }
      }
      return names;
    }

    public update(selStart = null): void {
      let editor = vscode.window.activeTextEditor;
      if (!editor) {
        this.testName = null;
        this.snapshotNames = [];
        return;
      }
      let text: string = editor.document.getText();

      if (!selStart) {
        selStart = editor.document.offsetAt(editor.selection.anchor);
      }

      // let propStart = text.lastIndexOf('{', selStart);
      let lastBracket = text.indexOf('}', selStart) - 1;
      let startSearch = this.findMatchingBracket(text, lastBracket);

      let paths = this.extractPaths(text, startSearch, lastBracket);
      if (!paths.testName) {
        if (!lastTest) {
          this.testName = null;
          this.snapshotNames = [];
        } else {
          paths.testName = lastTest;
          paths.folders = lastFolders;
          paths.snapshots = lastSnapshotNames;
        }
      }

      let storyId = paths.folders.map(f => f.replace(/\s/g, '-').toLowerCase()).join('-');
      let snapshotFileName =
        paths.folders.map(f => f.replace(/\s/g, '')).join('_') + '_snapshots.js';
      let rootPath = path.join(vscode.workspace.rootPath, 'src', 'tests', 'snapshots');
      let snapshotPath = path.join(rootPath, snapshotFileName);

      if (paths.testName && storyId) {
        this.storyId = storyId;
        this.testName = paths.testName;
        this.rootPath = rootPath;
        this.snapshotPath = snapshotPath;
        this.folders = paths.folders;
        this.snapshotNames = paths.snapshots;
        this.lastFileName = vscode.window.activeTextEditor.document.fileName;
      }
    }
  }

  abstract class HtmlProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private _snapshots: string = null;
    private _uri: vscode.Uri;
    protected extractor: StaticTextExtractor;

    constructor(extractor: StaticTextExtractor, uri: vscode.Uri) {
      this.extractor = extractor;
      this._uri = uri;
    }

    public abstract readFile();

    public provideTextDocumentContent(uri: vscode.Uri): string {
      if (!this._snapshots || this._snapshots === noTests) {
        this.extractor.update();
        this.readFile();
      }
      return this._snapshots;
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
      return this._onDidChange.event;
    }

    set snapshots(value: string) {
      this._snapshots = value;
      this._onDidChange.fire(this._uri);
    }
  }

  class SnapshotContentProvider extends HtmlProvider implements vscode.TextDocumentContentProvider {
    cache = {};
    publicPath = path.join(vscode.workspace.rootPath, 'public');

    constructor(extractor: StaticTextExtractor) {
      super(extractor, snapshotPreviewUri);
      // start watching file system
      let rootPath = path.join(vscode.workspace.rootPath, 'src', 'tests', 'snapshots', '**');
      let watcher = vscode.workspace.createFileSystemWatcher(rootPath);

      watcher.onDidChange(this.filesChanged);
      watcher.onDidCreate(this.filesChanged);
      watcher.onDidDelete(this.filesChanged);

      var net = require('net'),
        JsonSocket = require('json-socket');

      const _that = this;

      var port = 9838;
      var server = net.createServer();
      server.listen(port);
      server.on('connection', function(socket) {
        //This is a standard net.Socket
        socket = new JsonSocket(socket); //Now we've decorated the net.Socket to be a JsonSocket
        socket.on('message', function(message) {
          const file = message.file;
          const content = message.content;

          if (file.match(/.css/)) {
            _that.cache[file] = _that.parseStyles(content.styles);
            return;
          }

          _that.cache[file] = content;
          _that.readFile();
        });
      });
    }

    private parseStyles(styles: string) {
      return styles.replace(
        /: *'?url\("?\/?([\/\w\._]*)"?\)'?/g,
        `: url('file://${this.publicPath}/$1')`
      );
    }

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
      let styleName = path.basename(adjustedPath);
      styleName = styleName.substring(0, styleName.lastIndexOf('.')) + '.css';

      if (useCache) {
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
      delete(require.cache[adjustedPath])
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
      let bundleStylePath = path.join(this.publicPath, 'styles', 'bundle.css');
      let luisStylePath = path.join(this.publicPath, 'styles', 'luis.css');

      let snapshots = '';
      for (let key of Object.getOwnPropertyNames(ss)) {
        // remove snapshots that are not in this test
        if (snapshotNames.every(s => key.indexOf(s) === -1)) {
          continue;
        }
        let text = ss[key];

        if (text[0] === '{' || text[0] === '[') {
          text = `<pre>${text}</pre>`;
        }
        text = text.replace(/src="(\/|^h)/g, `src="file://${this.publicPath}/`);
        text = text.replace(
          /image (class="[\w ]+")? *href="\/?/g,
          `image $1 href="file://${this.publicPath}/`
        );
        text = text.replace(/link href="\/?/g, `link href="file://${this.publicPath}/`);
        text = text.replace(
          /: *'?url\("?\/?([\/\w\._]*)"?\)'?/g,
          `: url('file://${this.publicPath}/$1')`
        );
        text = text.replace(/-webkit-\w+,/g, '');
        text = text.replace(/-moz-\w+,/g, '');
        text = text.replace(/-ms-\w+,/g, '');
        snapshots += `
				<div class="ui fluid label">${key.replace(/ 1$/, '')}</div>
				<div class="${ss.cssClassName}" style="padding: 6px">${
          ss.decorator ? ss.decorator.replace('$snapshot', text) : text
        }</div>`;
      }

      // console.log(snapshots);
      let result = html.replace(
        '$body',
        `<div style="padding: 6px">
					${snapshots}
			</div>`
      );
      result = result.replace(
        '$style',
        `
				<style type='text/css'>
					${styles}
				</style>
				<link href='file://${luisStylePath}' rel='stylesheet' type='text/css'>
				<link href='file://${bundleStylePath}' rel='stylesheet' type='text/css'>
			`
      );

      lastSnapshots = result;
      lastFolders = folders;
      lastTest = testName;
      lastSnapshotNames = snapshotNames;
      lastFileName = vscode.window.activeTextEditor.document.fileName;

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

  class LuisContentProvider extends HtmlProvider implements vscode.TextDocumentContentProvider {
    currentUri = '';
    publicPath = path.join(vscode.workspace.rootPath, 'public');

    constructor(extractor: StaticTextExtractor) {
      super(extractor, componentPreviewUri);
    }

    get luisStylePath() {
      return path.join(this.publicPath, 'styles', 'luis.css');
    }

    get errorMessage() {
      return `
		<link href='file://${this.luisStylePath}' rel='stylesheet' type='text/css'>
		<span class="ui fluid info red label" style="margin: 6px">Please place your cursor in a test function to select the test</span>
		`;
    }

    public readFile() {
      if (!this.extractor.storyId || !this.extractor.testName) {
        this.snapshots = this.errorMessage;
        return this.errorMessage;
      }
      return this.frame(
        `http://localhost:9001/story/${this.extractor.storyId}/${this.extractor.testName &&
          this.extractor.testName.toLowerCase().replace(/\s/g, '-')}`
      );
    }

    private frame(uri: string) {
      let luisStylePath = path.join(this.publicPath, 'styles', 'luis.css');

      if (this.currentUri === uri) {
        return;
      }

      const html = `<style>iframe { background-color: white } </style>
			<link href='file://${luisStylePath}' rel='stylesheet' type='text/css'>
			<div class="ui grey inverted pointing secondary f1ujhx0c menu" style="margin-bottom: 0px">
				<a title="Refresh" class="icon item" onclick="javascript:document.getElementById('frame').src='${
          uri
        }?ignore=' + Math.random() * 1000"><i aria-hidden="true" class="refresh icon"></i></a>
				<div class="item">
					${uri}
				</div>
			</div>
			<iframe id="frame" src="${uri}" frameBorder="0" width="100%" height="1000px" />`;

      this.currentUri = uri;
      this.snapshots = html;

      return html;
    }
  }

  let extractor = new StaticTextExtractor();
  let snapshotProvider = new SnapshotContentProvider(extractor);
  let luisProvider = new LuisContentProvider(extractor);

  let snapshotRegistration = vscode.workspace.registerTextDocumentContentProvider(
    'snapshot-preview',
    snapshotProvider
  );

  let componentRegistration = vscode.workspace.registerTextDocumentContentProvider(
    'component-preview',
    luisProvider
  );

  let throttle = null;

  function throttledUpdate() {
    if (throttle) {
      clearTimeout(throttle);
    }
    throttle = setTimeout(() => {
      extractor.update();
      snapshotProvider.readFile();
      luisProvider.readFile();
    }, 400);
  }

  vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
    if (e.document === vscode.window.activeTextEditor.document) {
      throttledUpdate();
    }
  });

  vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
    if (e.textEditor === vscode.window.activeTextEditor) {
      throttledUpdate();
    }
  });

  let snapshotDisposable = vscode.commands.registerCommand('extension.showSnapshots', () => {
    return vscode.commands
      .executeCommand(
        'vscode.previewHtml',
        snapshotPreviewUri,
        vscode.ViewColumn.Three,
        'Snapshots'
      )
      .then(
        success => {},
        reason => {
          vscode.window.showErrorMessage(reason);
        }
      );
  });

  let componentDisposable = vscode.commands.registerCommand('extension.showComponent', () => {
    return vscode.commands
      .executeCommand('vscode.previewHtml', componentPreviewUri, vscode.ViewColumn.Two, 'Component')
      .then(
        success => {},
        reason => {
          vscode.window.showErrorMessage(reason);
        }
      );
  });

  let commandDisposable = vscode.commands.registerCommand('extension.showWebViewDevTools', () => {
    return vscode.commands.executeCommand('_webview.openDevTools').then(
      success => {},
      reason => {
        vscode.window.showErrorMessage(reason);
      }
    );
  });

  function updateSnapshot(fileSnapshots = true, position: number = null) {
    let updateTestCommand: string = fileSnapshots
      ? vscode.workspace.getConfiguration('snapshots').get('updateFileCommand')
      : vscode.workspace.getConfiguration('snapshots').get('updateTestCommand');

    if (!updateTestCommand) {
      vscode.window.showErrorMessage(
        'You need to specify "snapshots.updateTestCommand" and "snapshots.updateFileCommand" in your config. Use $1 for test name placeholder, $2 for file name'
      );
    }

    extractor.update(position);
    if (extractor.folders == null || extractor.testName == null) {
      vscode.window.showErrorMessage('Could not determine the test name');
      return;
    }

    try {
      let testName = extractor.folders.join(' '); // .map(f => f.replace(/\s/g, ''))
      if (!fileSnapshots) {
        testName += ' ' + extractor.testName;
      }

      let command = updateTestCommand.replace('$1', testName).replace('$2', extractor.lastFileName);
      console.log(command);
      cp.exec(command, { cwd: vscode.workspace.rootPath }, (err, stdout, stderr) => {
        if (err) {
          console.error(err);
          vscode.window.showErrorMessage(err.message);
        }
        // if (stderr) {
        //   vscode.window.showErrorMessage(stderr)
        // }
        if (stdout) {
          console.log(stdout);
          let tests = stdout.match(/(\d+) passing/);
          vscode.window.showInformationMessage(
            tests[1] + ' test(s) snapshots updated for "' + testName + '"'
          );
        }
      });
    } catch (ex) {
      vscode.window.showErrorMessage(ex.message);
    }
  }

  vscode.commands.registerCommand('extension.updateTestSnapshots', (match: RegexMatch) => {
    updateSnapshot(false, match ? match.offset : null);
  });

  vscode.commands.registerCommand('extension.updateFileSnapshots', () => {
    updateSnapshot(true);
  });

  context.subscriptions.push(snapshotDisposable, snapshotRegistration);
  context.subscriptions.push(componentDisposable, componentRegistration);

  // deal with code lens

  interface RegexMatch {
    document: vscode.TextDocument;
    regex: RegExp;
    range: vscode.Range;
    offset: number;
  }

  function createRegex(pattern: string, flags: string) {
    try {
      return new RegExp(pattern, flags);
    } catch (e) {
      // discard
    }
  }

  function createRegexMatch(document: vscode.TextDocument, line: number, match: RegExpExecArray, position: number) {
    const regex = createRegex(match[3], match[4]);
    if (regex) {
      return {
        document: document,
        regex: regex,
        range: new vscode.Range(
          line,
          match.index + match[1].length,
          line,
          match.index + match[1].length + match[2].length
        ),
        offset: position + match.index + match[1].length + 2
      };
    }
  }

  function findRegexes(document: vscode.TextDocument) {
    const matches: RegexMatch[] = [];
    let position = 0;
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      let match: RegExpExecArray | null;
      let regex = /(it\(|itMountsAnd\()(.*$)/g;
      regex.lastIndex = 0;
      const text = line.text.substr(0, 1000);
      while ((match = regex.exec(text))) {
        const result = createRegexMatch(document, i, match, position);
        if (result) {
          matches.push(result);
        }
      }
      position += line.text.length + 1;
    }
    return matches;
  }

  class SnapshotCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken) {
      console.log('Lensing ...');
      const matches = findRegexes(document);
      return matches.map(
        match =>
          new vscode.CodeLens(match.range, {
            title: 'Update snapshots...',
            command: 'extension.updateTestSnapshots',
            arguments: [match]
          })
      );
    }
  }

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        {
          language: 'typescript',
          scheme: 'file'
        },
        {
          language: 'typescriptreact',
          scheme: 'file'
        },
        {
          language: 'javascript',
          scheme: 'file'
        }
      ],
      new SnapshotCodeLensProvider()
    )
  );
}
