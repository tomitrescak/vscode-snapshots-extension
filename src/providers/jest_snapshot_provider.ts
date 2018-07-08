
import * as vscode from 'vscode';
import * as path from 'path';
import { StaticTextExtractor } from '../utils/static_text_extractor';
import { formatSnapshot } from '../utils/format';
import { startServer } from '../utils/json_server';

interface SavedSnapshot {
  time: number;
  content: string;
  testName: string;
  testPath: string;
  snapshotName: string;
}

export class JestSnapshotProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  private _uri: vscode.Uri;
  private publicPath = path.join(vscode.workspace.rootPath, 'public');

  private activeTestFile = null;
  private lastDate = Date.now();
  private cache: { [index: string]: SavedSnapshot[] } = {};

  constructor(uri: vscode.Uri) {
    this._uri = uri;

    this.update();

    startServer((message: SavedSnapshot) => {
      const content = message.content;
      const snapshotName = message.snapshotName;
      const testFile = path.parse(message.testPath).name;

      if (this.cache[testFile] == null) {
        this.cache[testFile] = [];
      }

      // clear old snapshots, older then two seconds
      this.cache[testFile] = this.cache[testFile].filter(s => Date.now() - s.time < 1500);

      const snapshots = this.cache[testFile];

      // find index of snapshot with the current name
      const index = snapshots.findIndex(s => s.snapshotName === snapshotName);

      // format content in html form
      message.content = formatSnapshot(content, this.publicPath);

      // insert into cache
      if (index >= 0) {
        snapshots[index] = message;
      } else {
        snapshots.push(message);
      }

      this.update();
    });
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  updateTestFile(fire = true) {
    if (vscode.window.activeTextEditor) {
      var file = vscode.window.activeTextEditor.document.fileName;
      if (file.match(/\.test\./)) {
        this.activeTestFile = path.parse(file).name;

        if (fire) this.update();
      }
    }
  }

  private update() {
    this._onDidChange.fire(this._uri);
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    if (!this.activeTestFile) {
      this.updateTestFile(false);
    }
    if (!this.activeTestFile) {
      return `<div>Please select a test file (*.test.*)</div>`;
    }
    const snapshots = this.cache[this.activeTestFile];
    if (!snapshots || snapshots.length === 0) {
      return `<div>No snapshots recorder for this test file</div>`;
    }

    return (
      `<div class="ui fluid blue label" style="margin: 3px">Test: ${this.activeTestFile}</div>` +
      snapshots
        .map(
          s => `<div class="ui fluid label" style="margin: 3px">${s.snapshotName}</div>` + s.content
        )
        .join('')
    );

    return '<div>No Snapshot Recorded. Please run jest. Last processed snapshot will show here.</div>';
  }
}
