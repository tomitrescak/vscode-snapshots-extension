
import * as vscode from 'vscode';
import * as cp from 'child_process';

import { StaticTextExtractor } from './static_text_extractor';

export function updateSnapshot(
  extractor: StaticTextExtractor,
  fileSnapshots = true,
  position: number = null
) {
  let updateTestCommand: string = fileSnapshots
    ? vscode.workspace.getConfiguration('snapshots').get('updateFileCommand')
    : vscode.workspace.getConfiguration('snapshots').get('updateTestCommand');

  if (!updateTestCommand) {
    vscode.window.showErrorMessage(
      'You need to specify "snapshots.updateTestCommand" and "snapshots.updateFileCommand" in your config. Use $1 for test name placeholder, $2 for file name'
    );
  }

  extractor.update(position, true);
  if (fileSnapshots) {
    extractor.testName = '';
  }
  if (extractor.folders == null || extractor.testName == null) {
    vscode.window.showErrorMessage('Could not determine the test name');
    return;
  }

  try {
    let testName = extractor.folders.join(' '); // .map(f => f.replace(/\s/g, ''))
    if (!fileSnapshots) {
      testName += ' ' + extractor.testName;
    }

    let command = updateTestCommand.replace('$1', testName).replace('$2', extractor.lastFileName);
    console.log(command);
    cp.exec(command, { cwd: vscode.workspace.rootPath }, (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        vscode.window.showErrorMessage(err.message);
      }
      // if (stderr) {
      //   vscode.window.showErrorMessage(stderr)
      // }
      if (stdout) {
        console.log(stdout);
        let tests = stdout.match(/(\d+) passing/);
        vscode.window.showInformationMessage(
          tests[1] + ' test(s) snapshots updated for "' + testName + '"'
        );
      }
    });
  } catch (ex) {
    vscode.window.showErrorMessage(ex.message);
  }
}
