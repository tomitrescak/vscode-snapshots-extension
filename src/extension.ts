/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const html = `<!DOCTYPE html>
<html>

<head>
    <title></title>
</head>

<body style="background: transparent; background-image: none!important">
    <link href='http://fonts.googleapis.com/css?family=Lato:400,700' rel='stylesheet' type='text/css'>
    <link href='https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.13/semantic.min.css' rel='stylesheet' type='text/css'>
		$style
		<div style="background: white">
		$body
		</div>
</body>

</html>`;

let lastTest = null;
let lastSnapshots = null;
let lastFolders = null;

export function activate(context: vscode.ExtensionContext) {

	let previewUri = vscode.Uri.parse('css-preview://authority/css-preview');

	class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
		private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

		public provideTextDocumentContent(uri: vscode.Uri): string {
			return this.createCssSnippet();
		}

		get onDidChange(): vscode.Event<vscode.Uri> {
			return this._onDidChange.event;
		}

		public update(uri: vscode.Uri) {
			this._onDidChange.fire(uri);
		}

		private createCssSnippet() {
			// let editor = vscode.window.activeTextEditor;
			// if (!(editor.document.languageId === 'css')) {
			// 	return this.errorSnippet("Active editor doesn't show a CSS document - no properties to preview.")
			// }
			return this.testExtraction();
			// return this.frame('http://localhost:9001');
		}


		private testWordAtPosition(text: string, word: string, position: number) {
			if (text[position] !== '\'') {
				return;
			}
			
			let currentPosition = position;
			for (let i=0; i<word.length; i++) {
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
			let quote = text[position] === '"' ? '"' : '\'';
		
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

		private findMatchingBracket(text: string, position: number) {
			let brackets = 1;
			while (text[position] != undefined && brackets > 0) {
				if (text[position] === '{') {
					brackets--;
				} else if (text[position] === '}') {
					brackets++;
				}
				position--;
			}
			return position;
		}

		private extractPaths(text: string, contextStart: number): { testName: string, folders?: string[], snapshots?: string } {
			let testName = null;
			let folders = [];
			let preview = null;

			for (let i=contextStart; i>=0; i--) {
				if (!testName) {
					if (this.testWordAtPosition(text, 'it(\'', i) || this.testWordAtPosition(text, 'itMountsAnd(\'', i)) {
						testName = this.extractText(text, i + 1);
					} 
				}
				if (this.testWordAtPosition(text, 'describe(\'', i) || this.testWordAtPosition(text, 'storyOf(\'', i)) {
					folders.push(this.extractText(text, i + 1));
					i = this.findMatchingBracket(text, i);
				} 
			}

			return {
				testName,
				folders: folders.reverse()
			};
		}

		private extractSnapshotNames(text: string, contextStart: number, contextEnd: number) {
			let names = [];
			for (let i=contextEnd; i>= contextStart; i--) {
				if (this.testWordAtPosition(text, 'matchSnapshot(\'', i)) {
					names.push(this.extractText(text, i + 1));
				}
			}
			return names;
		}

		

		private testExtraction() {
			let editor = vscode.window.activeTextEditor;
			if (!editor) {
				return `<div>No test found!</div>`;
			}

			let text: string = editor.document.getText();
			let selStart = editor.document.offsetAt(editor.selection.anchor);
			
			// let propStart = text.lastIndexOf('{', selStart);
			let lastBracket = text.indexOf('}', selStart) - 1;
			let startSearch = this.findMatchingBracket(text, lastBracket);

			let paths = this.extractPaths(text, startSearch);
			if (!paths.testName) {
				if (!lastTest) {
					return `<div>No test found!</div>`;
				} else {
					paths.testName = lastTest;
					paths.folders = lastFolders;
				}
			}

			let snapshotFileName = paths.folders.map(f => f.replace(/\s/g, '')).join('_') + '_snapshots.json';
			let publicPath =  path.join(vscode.workspace.rootPath, 'public');
			let rootPath = path.join(vscode.workspace.rootPath, 'src', 'tests', 'snapshots');
			let snapshotPath = path.join(rootPath, snapshotFileName);
			let generatedStylePath = path.join(rootPath, 'generated.css'); 
			let bundleStylePath = path.join(publicPath, 'styles', 'bundle.css'); 

			let file = fs.readFileSync(snapshotPath, { encoding: 'utf-8' });
			let ss = JSON.parse(file);
			
			let snapshotNames = this.extractSnapshotNames(text, startSearch, lastBracket);
			snapshotNames.push(paths.testName);

			let snapshots = '';
			for (let key of Object.getOwnPropertyNames(ss)) {
				// remove snapshots that are not in this test
				if (snapshotNames.every(s => key.indexOf(s) === -1)) {
					continue;
				}
				let text = ss[key].replace(/src="(\/|^h)/g, `src="file://${publicPath}/`);
				text = text.replace(/href="\/?/g, `href="file://${publicPath}/`);
				snapshots += `
				<div class="ui fluid label">${key.replace(/ 1$/, '')}</div>
				<div style="padding: 6px">${text}</div>`
			}

			// console.log(snapshots);
			

			let result = html.replace('$body', `<div style="padding: 6px">
				<div class="ui divided header">Test: ${paths.testName}</div>
				${snapshots}
			</div>`);
			result = result.replace('$style', `
				<link href='file://${generatedStylePath}' rel='stylesheet' type='text/css'>
				<link href='file://${bundleStylePath}' rel='stylesheet' type='text/css'>
			`)

			lastSnapshots = result;
			lastFolders = paths.folders;
			lastTest = paths.testName;

			return result;
		}

		// private frame(uri: string) {
		// 	return `<style>iframe { background-color: white } </style>
		// 	<iframe src="${uri}" frameBorder="0" width="100%" height="1000px" />`;
		// }

	}

	let provider = new TextDocumentContentProvider();
	let registration = vscode.workspace.registerTextDocumentContentProvider('css-preview', provider);
	let throttle = null;

	function throttledUpdate() {
		if (throttle) {
			clearTimeout(throttle);
		}
		throttle = setTimeout(() => provider.update(previewUri), 600);
	}

	vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
		if (e.document === vscode.window.activeTextEditor.document) {
			throttledUpdate();
		}
	});

	vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
		if (e.textEditor === vscode.window.activeTextEditor) {
			throttledUpdate();
		}
	})

	let disposable = vscode.commands.registerCommand('extension.showSnapshots', () => {
		return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'Snapshots').then((success) => {
		}, (reason) => {
			vscode.window.showErrorMessage(reason);
		});
	});

	let highlight = vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(200,200,200,.35)' });

	vscode.commands.registerCommand('extension.revealCssRule', (uri: vscode.Uri, propStart: number, propEnd: number) => {

		for (let editor of vscode.window.visibleTextEditors) {
			if (editor.document.uri.toString() === uri.toString()) {
				let start = editor.document.positionAt(propStart);
				let end = editor.document.positionAt(propEnd + 1);

				editor.setDecorations(highlight, [new vscode.Range(start, end)]);
				setTimeout(() => editor.setDecorations(highlight, []), 1500);
			}
		}
	});

	context.subscriptions.push(disposable, registration);
}
