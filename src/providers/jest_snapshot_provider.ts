//@ts-ignore
import * as vscode from 'vscode';
import * as path from 'path';
import { StaticTextExtractor } from '../utils/static_text_extractor';
import { formatSnapshot } from '../utils/format';
import { startServer } from '../utils/json_server';

export class JestSnapshotProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  private _uri: vscode.Uri;
  private publicPath = path.join(vscode.workspace.rootPath, 'public');

  private lastDate = Date.now();
  private snapshots = [];

  constructor(uri: vscode.Uri) {
    this._uri = uri;

    startServer(message => {
      const content = message.content;
      const count = vscode.workspace.getConfiguration('snapshots').get('previewCount');

      // if last result came over second ago we purge results
      if (Date.now() - this.lastDate > 1000) {
        this.snapshots = [];
        this.lastDate = Date.now();
      }

      var snapshot = formatSnapshot(content, this.publicPath);

      if (this.snapshots.length < count) {
        this.snapshots.push(snapshot);
      } else {
        this.snapshots[count - 1] = snapshot;
      }

      this._onDidChange.fire(this._uri);
    });
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    if (this.snapshots.length) {
      return this.snapshots.join('<hr style="border-bottom: 1px dashed;" />');
    }
    return '<div>No Snapshot Recorded. Please run jest. Last processed snapshot will show here.</div>';
  }
}
