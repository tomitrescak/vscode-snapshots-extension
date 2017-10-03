/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const noTests = `<div>No test found!</div>`;

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
let lastSnapshotNames = null;
let lastFolders = null;

export function activate(context: vscode.ExtensionContext) {

	let snapshotPreviewUri = vscode.Uri.parse('snapshot-preview://authority/snapshot-preview');
	let componentPreviewUri = vscode.Uri.parse('component-preview://authority/component-preview');

	abstract class HtmlProvider implements vscode.TextDocumentContentProvider {
		private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
		private _snapshots: string = null;
		private _uri: vscode.Uri;

		testName: string;
		rootPath: string;
		snapshotPath: string;
		folders: string[];
		snapshotNames: string[];
		storyId: string;

		constructor(watchFiles = true) {
			if (watchFiles) {
				// start watching file system
				let rootPath = path.join(vscode.workspace.rootPath, 'src', 'tests', 'snapshots', '**');
				let watcher = vscode.workspace.createFileSystemWatcher(rootPath);

				watcher.onDidChange(this.filesChanged);
				watcher.onDidCreate(this.filesChanged);
				watcher.onDidDelete(this.filesChanged);
			}
		}

		protected abstract readFile();

		private filesChanged = (e: any) => {
			this.readFile();

			return { dispose() { }}
		}

		public provideTextDocumentContent(uri: vscode.Uri): string {
			this._uri = uri;

			if (!this._snapshots || this._snapshots === noTests) {
				this._snapshots = this.testExtraction();
			}
			return this._snapshots;
		}

		get onDidChange(): vscode.Event<vscode.Uri> {
			return this._onDidChange.event;
		}

		public update(uri: vscode.Uri) {
			this._uri = uri;
			this.testExtraction();
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

		private findMatchingBracket(text: string, position: number, openBracket = '{', closeBracket = '}', increment = -1) {
			let brackets = 1;
			while (text[position] != undefined && brackets > 0) {
				if (text[position] === openBracket) {
					brackets--;
				} else if (text[position] === closeBracket) {
					brackets++;
				}
				position += increment;
			}
			return position;
		}

		private extractPaths(text: string, contextStart: number, contextEnd: number): { testName: string, folders?: string[], snapshots?: string[] } {
			let testName = null;
			let folders = [];
			let preview = null;

			let testStart = null;
			let testEnd = null;

			for (let i=contextStart; i>=0; i--) {
				if (!testName) {
					if (this.testWordAtPosition(text, 'it(\'', i) || this.testWordAtPosition(text, 'itMountsAnd(\'', i) || this.testWordAtPosition(text, 'itMountsContainerAnd(\'', i)) {
						testName = this.extractText(text, i + 1);
						testStart = i;
						testEnd = this.findMatchingBracket(text, i, ')', '(', 1);
					} 
				}
				if (testName) {
					if (this.testWordAtPosition(text, 'describe(\'', i) || this.testWordAtPosition(text, 'storyOf(\'', i)) {
						folders.push(this.extractText(text, i + 1));
						i = this.findMatchingBracket(text, i);
					} 
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
			for (let i=contextEnd; i>= contextStart; i--) {
				if (this.testWordAtPosition(text, 'matchSnapshot(\'', i)) {
					names.push(this.extractText(text, i + 1));
				}
			}
			return names;
		}

		set snapshots(value: string) {
			this._snapshots = value;
			this._onDidChange.fire(this._uri);
		}

		private testExtraction(): string {
			let editor = vscode.window.activeTextEditor;
			if (!editor) {
				this.snapshots = noTests;
				return noTests;
			}

			let text: string = editor.document.getText();
			let selStart = editor.document.offsetAt(editor.selection.anchor);
			
			// let propStart = text.lastIndexOf('{', selStart);
			let lastBracket = text.indexOf('}', selStart) - 1;
			let startSearch = this.findMatchingBracket(text, lastBracket);

			let paths = this.extractPaths(text, startSearch, lastBracket);
			if (!paths.testName) {
				if (!lastTest) {
					this.snapshots = noTests;
					return noTests;
				} else {
					paths.testName = lastTest;
					paths.folders = lastFolders;
					paths.snapshots = lastSnapshotNames;
				}
			}

			let storyId = paths.folders.map(f => f.replace(/\s/g, '-').toLowerCase()).join('-');
			let snapshotFileName = paths.folders.map(f => f.replace(/\s/g, '')).join('_') + '_snapshots.json';	
			let rootPath = path.join(vscode.workspace.rootPath, 'src', 'tests', 'snapshots');
			let snapshotPath = path.join(rootPath, snapshotFileName);

			if (paths.testName) {
				this.storyId = storyId;
				this.testName = paths.testName;
				this.rootPath = rootPath;
				this.snapshotPath = snapshotPath;
				this.folders = paths.folders;
				this.snapshotNames = paths.snapshots;


				// if (delay) {
				// 	console.log('With delay');
				// 	setTimeout(() => this.readFile(), 600);
				// } else {
					console.log('Without delay');
					return this.readFile();
				//}
			}
		}
	}

	class SnapshotContentProvider extends HtmlProvider implements vscode.TextDocumentContentProvider {
	
		protected readFile() {
			console.log('updating ...');
			try {
				let stats = fs.statSync(this.snapshotPath);
				// let now = new Date().getTime();
				// if (now - stats.mtime.getTime() < 500) {
				// 	console.log('Delaying ...');
				// 	setTimeout(() => this.readFile(testName, rootPath, snapshotPath, folders, snapshotNames), 500);
				// 	return `Reading file`;
				// }
			} catch (ex) {
				this.snapshots = 'Error accessing snapshot file: ' + ex.message;
				return;
			}

			let file = fs.readFileSync(this.snapshotPath, { encoding: 'utf-8' });

			let publicPath =  path.join(vscode.workspace.rootPath, 'public');
			let generatedStylePath = path.join(this.rootPath, 'generated.css'); 
			let bundleStylePath = path.join(publicPath, 'styles', 'bundle.css'); 

			let ss = JSON.parse(file);
			
			let snapshots = '';
			for (let key of Object.getOwnPropertyNames(ss)) {
				// remove snapshots that are not in this test
				if (this.snapshotNames.every(s => key.indexOf(s) === -1)) {
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
				<div class="ui divided header">Test: ${this.testName}</div>
				${snapshots}
			</div>`);
			result = result.replace('$style', `
				<link href='file://${generatedStylePath}' rel='stylesheet' type='text/css'>
				<link href='file://${bundleStylePath}' rel='stylesheet' type='text/css'>
			`)

			lastSnapshots = result;
			lastFolders = this.folders;
			lastTest = this.testName;
			lastSnapshotNames = this.snapshotNames;

			this.snapshots = result;

			if (vscode.workspace.getConfiguration('snapshots').get('saveHtml')) {
				fs.writeFileSync(path.join(this.rootPath, 'output.html'), result);
			}

			return result;
		}

		// private frame(uri: string) {
		// 	return `<style>iframe { background-color: white } </style>
		// 	<iframe src="${uri}" frameBorder="0" width="100%" height="1000px" />`;
		// }

	}

	class LuisContentProvider extends HtmlProvider implements vscode.TextDocumentContentProvider {
		currentUri = '';

		constructor() {
			super(false);
		}

		protected readFile() {
			return this.frame(`http://localhost:9001/bare/${this.storyId}/${this.testName && this.testName.toLowerCase().replace(/\s/g, '-') }`);
		}

		private frame(uri: string) {
			if (this.currentUri === uri) {
				return;
			}

			const html = `<style>iframe { background-color: white } </style>
			<div>${uri}</div>
			<iframe src="${uri}" frameBorder="0" width="100%" height="1000px" />`;
			
			this.currentUri = uri;
			this.snapshots = html;

			return html;
		}

	}

	let snapshotProvider = new SnapshotContentProvider();
	let luisProvider = new LuisContentProvider();

	let snapshotRegistration = vscode.workspace.registerTextDocumentContentProvider('snapshot-preview', snapshotProvider);
	let componentRegistration = vscode.workspace.registerTextDocumentContentProvider('component-preview', luisProvider);

	let throttle = null;

	function throttledUpdate() {
		if (throttle) {
			clearTimeout(throttle);
		}
		throttle = setTimeout(() => {
			snapshotProvider.update(snapshotPreviewUri);
			luisProvider.update(componentPreviewUri);
		}, 400);
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

	let snapshotDisposable = vscode.commands.registerCommand('extension.showSnapshots', () => {
		return vscode.commands.executeCommand('vscode.previewHtml', snapshotPreviewUri, vscode.ViewColumn.Two, 'Snapshots').then((success) => {
		}, (reason) => {
			vscode.window.showErrorMessage(reason);
		});
	});

	let componentDisposable = vscode.commands.registerCommand('extension.showComponent', () => {
		return vscode.commands.executeCommand('vscode.previewHtml', componentPreviewUri, vscode.ViewColumn.Two, 'Component').then((success) => {
		}, (reason) => {
			vscode.window.showErrorMessage(reason);
		});
	});

	context.subscriptions.push(snapshotDisposable, snapshotRegistration);
	context.subscriptions.push(componentDisposable, componentRegistration);
}
