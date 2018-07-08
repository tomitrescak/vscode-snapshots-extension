
import * as vscode from 'vscode';
import { findRegexes, findFileRegexes } from '../utils/regex';

export class SnapshotCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken) {
    const matches = findRegexes(document);
    const describeMatches = findFileRegexes(document);
    return matches
      .map(
        match =>
          new vscode.CodeLens(match.range, {
            title: 'Update snapshots',
            command: 'extension.updateTestSnapshots',
            arguments: [match]
          })
      )
      .concat(
        describeMatches.map(
          match =>
            new vscode.CodeLens(match.range, {
              title: 'Update snapshots',
              command: 'extension.updateFileSnapshots',
              arguments: [match]
            })
        )
      );
  }
}
