
import * as vscode from 'vscode';

import { StaticTextExtractor } from '../utils/static_text_extractor';

export const noTests = `<div>No test found!</div>`;

export abstract class HtmlProvider implements vscode.TextDocumentContentProvider {
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
