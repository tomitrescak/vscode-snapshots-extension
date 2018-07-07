/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';

//@ts-ignore
import * as vscode from 'vscode';
import { RegexMatch } from './utils/regex';
import { updateSnapshot } from './utils/snapshots';
import { StaticTextExtractor } from './utils/static_text_extractor';
import { SnapshotContentProvider } from './providers/snapshot_content_provider';
import { SnapshotContentPreviewProvider } from './providers/snapshot_content_preview_provider';
import { SnapshotCodeLensProvider } from './providers/snapshot_codelens_provider';
import { LuisContentProvider } from './providers/luis_content_provider';
import { JestSnapshotProvider } from './providers/jest_snapshot_provider';

export function activate(context: vscode.ExtensionContext) {
  // uri configurations

  let snapshotPreviewUri = vscode.Uri.parse('snapshot-preview://authority/snapshot-preview');
  let snapshotContentPreviewUri = vscode.Uri.parse(
    'snapshot-content-preview://authority/snapshot-content-preview'
  );
  let componentPreviewUri = vscode.Uri.parse('component-preview://authority/component-preview');
  let jestPreviewUri = vscode.Uri.parse('jest-preview://authority/jest-preview');

  // providers

  let extractor = new StaticTextExtractor();
  let snapshotProvider = new SnapshotContentProvider(extractor, snapshotPreviewUri);
  let luisProvider = new LuisContentProvider(extractor, componentPreviewUri);
  let snapshotPreviewProvider = new SnapshotContentPreviewProvider(snapshotContentPreviewUri);
  let jestPreviewProvider = new JestSnapshotProvider(jestPreviewUri);

  let snapshotRegistration = vscode.workspace.registerTextDocumentContentProvider(
    'snapshot-preview',
    snapshotProvider
  );

  let snapshotContentPreviewRegistration = vscode.workspace.registerTextDocumentContentProvider(
    'snapshot-content-preview',
    snapshotPreviewProvider
  );

  let componentRegistration = vscode.workspace.registerTextDocumentContentProvider(
    'component-preview',
    luisProvider
  );

  let jestRegistration = vscode.workspace.registerTextDocumentContentProvider(
    'jest-preview',
    jestPreviewProvider
  );

  let throttle = null;

  function throttledUpdate() {
    if (throttle) {
      clearTimeout(throttle);
    }
    throttle = setTimeout(() => {
      extractor.update();
      snapshotProvider.readFile();
      luisProvider.readFile();
      snapshotPreviewProvider.update();
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
  });

  let snapshotDisposable = vscode.commands.registerCommand('extension.showSnapshots', () => {
    return vscode.commands
      .executeCommand(
        'vscode.previewHtml',
        snapshotPreviewUri,
        vscode.ViewColumn.Three,
        'Snapshots'
      )
      .then(
        success => {},
        reason => {
          vscode.window.showErrorMessage(reason);
        }
      );
  });

  let componentDisposable = vscode.commands.registerCommand('extension.showComponent', () => {
    return vscode.commands
      .executeCommand('vscode.previewHtml', componentPreviewUri, vscode.ViewColumn.Two, 'Component')
      .then(
        success => {},
        reason => {
          vscode.window.showErrorMessage(reason);
        }
      );
  });

  let snapshotContentPreviewDisposable = vscode.commands.registerCommand(
    'extension.previewSnapshotFile',
    () => {
      return vscode.commands
        .executeCommand(
          'vscode.previewHtml',
          snapshotContentPreviewUri,
          vscode.ViewColumn.Two,
          'Component'
        )
        .then(
          success => {},
          reason => {
            vscode.window.showErrorMessage(reason);
          }
        );
    }
  );

  let jestPreviewDisposable = vscode.commands.registerCommand('extension.luisSnapshot', () => {
    return vscode.commands
      .executeCommand('vscode.previewHtml', jestPreviewUri, vscode.ViewColumn.Two, 'Component')
      .then(
        success => {},
        reason => {
          vscode.window.showErrorMessage(reason);
        }
      );
  });

  vscode.commands.registerCommand('extension.updateTestSnapshots', (match: RegexMatch) => {
    updateSnapshot(extractor, false, match ? match.offset : null);
  });

  vscode.commands.registerCommand('extension.updateFileSnapshots', (match: RegexMatch) => {
    updateSnapshot(extractor, true, match ? match.offset : null);
  });

  context.subscriptions.push(snapshotDisposable, snapshotRegistration);
  context.subscriptions.push(componentDisposable, componentRegistration);
  context.subscriptions.push(snapshotContentPreviewDisposable, snapshotContentPreviewRegistration);
  context.subscriptions.push(jestPreviewDisposable, jestRegistration);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        {
          language: 'typescript',
          scheme: 'file'
        },
        {
          language: 'typescriptreact',
          scheme: 'file'
        },
        {
          language: 'javascript',
          scheme: 'file'
        }
      ],
      new SnapshotCodeLensProvider()
    )
  );
}
