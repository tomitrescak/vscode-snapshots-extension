import * as vscode from 'vscode';
import * as path from 'path';

import { findMatchingBracket } from './utils';

export class StaticTextExtractor {
  testName: string;
  rootPath: string;
  snapshotPath: string;
  folders: string[];
  snapshotNames: string[];
  storyId: string;

  watchPath: (string) => void;

  lastTest = null;
  lastSnapshotNames = null;
  lastFolders = null;
  lastFileName: string;
  lastSnapshots = null;
  lastStoryId = null;

  watchPaths = {};

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
          testEnd = findMatchingBracket(text, i, ')', '(', 1);
        }
      }

      if (
        this.testWordAtPosition(text, "describe('", i) ||
        this.testWordAtPosition(text, "storyOf('", i)
      ) {
        folders.push(this.extractText(text, i + 1));
        i = findMatchingBracket(text, i);
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

  public update(selStart = null, acceptFolders = false): void {
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
    let startSearch = findMatchingBracket(text, lastBracket);

    let filePath = vscode.window.activeTextEditor.document.fileName;
    let directory = path.join(path.dirname(filePath), '__snapshots__');

    // adjust for wallaby
    // try {
    //   let cacheFile = path.join(vscode.workspace.rootPath, '.cache');
    //   fs.statSync(cacheFile);
    //   let cacheDir = fs.readFileSync(cacheFile, { encoding: 'utf-8' });
    //   let fileDir = path.dirname(filePath);
    //   directory = directory.replace(vscode.workspace.rootPath, cacheDir);
    // } catch {}
    let fileName = path.basename(filePath);
    let snapshotFileName = fileName + '.snap';
    let snapshotPath = path.join(directory, snapshotFileName);

    let paths = this.extractPaths(text, startSearch, lastBracket);
    if (acceptFolders && paths.folders) {
      if (!paths.testName) {
        paths.testName = '';
      }
    }

    if (paths.testName == null) {
      if (!this.lastTest) {
        this.testName = null;
        this.snapshotNames = [];
      } else {
        paths.testName = this.lastTest;
        paths.folders = this.lastFolders;
        paths.snapshots = this.lastSnapshotNames;
      }
    }

    let storyId = paths.folders.map(f => f.replace(/\s/g, '-').toLowerCase()).join('-');
    let rootPath = path.join(directory);

    if (paths.testName != null && storyId) {
      this.storyId = storyId;
      this.testName = paths.testName;
      this.rootPath = rootPath;
      this.snapshotPath = snapshotPath;
      this.folders = paths.folders;
      this.snapshotNames = paths.snapshots;
      this.lastFileName = vscode.window.activeTextEditor.document.fileName;
      this.lastStoryId = storyId;

      if (this.watchPath) {
        this.watchPath(this.rootPath);
      }
    }
  }
}
