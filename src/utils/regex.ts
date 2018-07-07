import * as vscode from 'vscode';

import { findMatchingBracket } from './utils';

export interface RegexMatch {
  document: vscode.TextDocument;
  regex: RegExp;
  range: vscode.Range;
  offset: number;
}

export function createRegex(pattern: string, flags: string) {
  try {
    return new RegExp(pattern, flags);
  } catch (e) {
    // discard
  }
}

export function createRegexMatch(
  document: vscode.TextDocument,
  line: number,
  match: RegExpExecArray,
  position: number
) {
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

export function findRegexes(document: vscode.TextDocument) {
  const matches: RegexMatch[] = [];
  let position = 0;
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    let match: RegExpExecArray | null;
    let regex = /(it\s*\(|itMountsAnd\s*\(|itMountsContainerAnd\s*\()(.*$)/g;
    regex.lastIndex = 0;
    const text = line.text.substr(0, 1000);
    while ((match = regex.exec(text))) {
      const result = createRegexMatch(document, i, match, position);
      if (result) {
        // check if there is match snapshot there
        let documentText = document.getText();
        let start = position + match.index + match[1].length + 2;
        let end = findMatchingBracket(documentText, start, ')', '(', 1);
        let test = documentText.substring(start, end);
        if (test.indexOf('matchSnapshot') >= 0) {
          matches.push(result);
        }
      }
    }
    position += line.text.length + 1;
  }
  return matches;
}

export function findFileRegexes(document: vscode.TextDocument) {
  const matches: RegexMatch[] = [];
  let position = 0;
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    let match: RegExpExecArray | null;
    let regex = /(describe\s*\()(.*$)/g;
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
