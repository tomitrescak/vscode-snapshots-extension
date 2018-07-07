//@ts-ignore
import * as vscode from 'vscode';
import * as path from 'path';
import { StaticTextExtractor } from '../utils/static_text_extractor';
import { formatSnapshot } from '../utils/format';

export class SnapshotContentPreviewProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  private _uri: vscode.Uri;
  snapshots = {};
  publicPath = path.join(vscode.workspace.rootPath, 'public');

  constructor(uri: vscode.Uri) {
    this._uri = uri;
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  private updateWatchedFile = e => {
    this.snapshots[e.path] = null;

    // this.readFile(e.path);
    this._onDidChange.fire(this._uri);
  };

  private readFile(path: string) {
    delete require.cache[path];
    let snapshots = require(path);

    return formatSnapshot(snapshots, this.publicPath);
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    let filePath = vscode.window.activeTextEditor.document.fileName;
    if (!this.snapshots[filePath]) {
      // start watcher
      let watcher = vscode.workspace.createFileSystemWatcher(filePath);
      watcher.onDidChange(this.updateWatchedFile);

      this.snapshots[filePath] = this.readFile(filePath);
    }

    return this.snapshots[filePath];
  }
}
