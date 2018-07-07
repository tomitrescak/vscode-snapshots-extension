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
  private snapshot = null;

  constructor(uri: vscode.Uri) {
    this._uri = uri;

    startServer(message => {
      const content = message.content;

      this.snapshot = formatSnapshot(content, this.publicPath);

      this._onDidChange.fire(this._uri);
    });
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return (
      this.snapshot ||
      '<div>No Snapshot Recorded. Please run jest. Last processed snapshot will show here.</div>'
    );
  }
}
