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

<body>
    <link href='http://fonts.googleapis.com/css?family=Lato:400,700' rel='stylesheet' type='text/css'>
    <link href='https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.13/semantic.min.css' rel='stylesheet' type='text/css'>
		<link rel="stylesheet" type="text/css" href="http://localhost:9001/styles/bundle.css" /> 
		<div style="background: white">
		$body
		</div>
</body>

</html>`;

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

		private extractPaths(text: string, contextStart: number) {
			let testName = null;
			let folders = [];

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
				folders
			};
		}

		

		private testExtraction() {
			let editor = vscode.window.activeTextEditor;
			let text: string = editor.document.getText();
			let selStart = editor.document.offsetAt(editor.selection.anchor);
			
			// let propStart = text.lastIndexOf('{', selStart);
			let lastBracket = text.indexOf('}', selStart) - 1;
			let startSearch = this.findMatchingBracket(text, lastBracket);

			let paths = this.extractPaths(text, startSearch);
			if (!paths.testName) {
				return `<div>No test found!</div>`;
			}

			let snapshotFileName = paths.folders.reverse().map(f => f.replace(/\s/g, '')).join('_') + '_snapshots.json';
			let rootPath = path.join(vscode.workspace.rootPath, 'src', 'tests', 'snapshots', snapshotFileName);
			let file = fs.readFileSync(rootPath, { encoding: 'utf-8' });
			let ss = JSON.parse(file);

			let snapshots = '';
			for (let key of Object.getOwnPropertyNames(ss)) {
				let text = ss[key].replace(/src="(\/|^h)/g, 'src="http://localhost:9001/');
				text = text.replace(/href="\/?/g, 'href="http://localhost:9001/');
				snapshots += `
				<div class="ui fluid label">${key}</div>
				<div style="padding: 6px">${text}</div>`
			}

			console.log(snapshots);
			

			return html.replace('$body', `<div style="padding: 6px">
				<div class="ui divided header">Test: ${paths.testName}</div>
				${snapshots}
			</div>`);
		}

		// private frame(uri: string) {
		// 	return `<style>iframe { background-color: white } </style>
		// 	<iframe src="${uri}" frameBorder="0" width="100%" height="1000px" />`;
		// }

	}

	let provider = new TextDocumentContentProvider();
	let registration = vscode.workspace.registerTextDocumentContentProvider('css-preview', provider);

	vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
		if (e.document === vscode.window.activeTextEditor.document) {
			provider.update(previewUri);
		}
	});

	vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
		if (e.textEditor === vscode.window.activeTextEditor) {
			provider.update(previewUri);
		}
	})

	let disposable = vscode.commands.registerCommand('extension.showCssPropertyPreview', () => {
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
