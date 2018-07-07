//@ts-ignore
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { formatSnapshot } from '../utils/format';

export class SnapshotContentPreviewProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  private _uri: vscode.Uri;
  private content = '<div>Select a snapshot file or a test file</div>';

  snapshots = {};
  publicPath = path.join(vscode.workspace.rootPath, 'public');

  constructor(uri: vscode.Uri) {
    this._uri = uri;

    this.checkFile();
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  private updateWatchedFile = e => {
    this.snapshots[e.path] = null;

    // this.readFile(e.path);
    this.update();
  };

  private readFile(path: string) {
    delete require.cache[path];
    let snapshots = require(path);

    return formatSnapshot(snapshots, this.publicPath);
  }

  private checkFile() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    let filePath = editor.document.fileName;

    if (!filePath.match(/\.snap/)) {
      const snap = path.join(
        path.dirname(filePath),
        '__snapshots__',
        path.basename(filePath) + '.snap'
      );
      if (fs.existsSync(snap)) {
        filePath = snap;
      } else {
        return;
      }
    }

    if (!this.snapshots[filePath]) {
      // start watcher
      let watcher = vscode.workspace.createFileSystemWatcher(filePath);
      watcher.onDidChange(this.updateWatchedFile);

      this.snapshots[filePath] = this.readFile(filePath);
    }

    this.content = this.snapshots[filePath];
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.content;
  }

  public update() {
    this.checkFile();
    this._onDidChange.fire(this._uri);
  }
}
