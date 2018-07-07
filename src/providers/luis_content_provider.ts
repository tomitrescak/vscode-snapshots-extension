//@ts-ignore
import * as vscode from 'vscode';
import * as path from 'path';

import { HtmlProvider } from './html_provider';
import { StaticTextExtractor } from '../utils/static_text_extractor';

export class LuisContentProvider extends HtmlProvider
  implements vscode.TextDocumentContentProvider {
  currentUri = '';
  publicPath = path.join(vscode.workspace.rootPath, 'public');

  constructor(extractor: StaticTextExtractor, uri: any) {
    super(extractor, uri);
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
      `http://localhost:9001?story=${this.extractor.storyId}${this.extractor.testName &&
        '&test=' + this.extractor.testName.toLowerCase().replace(/\s/g, '-')}`
    );
  }

  private frame(uri: string) {
    let luisStylePath = path.join(this.publicPath, 'styles', 'luis.css');

    if (this.currentUri === uri) {
      return;
    }

    const html = `<style>iframe { background-color: white } </style>
    <link href='file://${luisStylePath}' rel='stylesheet' type='text/css'>
    <div class="ui grey inverted pointing secondary menu" style="margin-bottom: 0px">
      <a title="Refresh" class="icon item" onclick="javascript:document.getElementById('frame').src='${uri}?ignore=' + Math.random() * 1000"><i aria-hidden="true" class="refresh icon"></i></a>
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
