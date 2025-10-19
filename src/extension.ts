import * as vscode from 'vscode';
import { spawn } from 'child_process';

let statusBarItem: vscode.StatusBarItem;
const fileEncodings = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {
    console.log('Encoding Detector extension is now active!');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'encoding-detector.showEncodingInfo';
    context.subscriptions.push(statusBarItem);

    // Detect encoding when a file is opened
    vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (shouldProcessDocument(document)) {
            await detectAndShowEncoding(document);
        }
    });

    // Update when switching between files
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor && shouldProcessDocument(editor.document)) {
            await detectAndShowEncoding(editor.document);
        } else {
            statusBarItem.hide();
        }
    });

    // Check initial file if one is open on startup
    if (vscode.window.activeTextEditor) {
        const document = vscode.window.activeTextEditor.document;
        if (shouldProcessDocument(document)) {
            detectAndShowEncoding(document);
        }
    }

    // Command to show detailed encoding info when status bar is clicked
    const showInfoCommand = vscode.commands.registerCommand(
        'encoding-detector.showEncodingInfo',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const filePath = editor.document.uri.fsPath;
            const encoding = fileEncodings.get(filePath);

            if (encoding) {
                const safeEncodings = getSafeEncodings();
                const isProblematic = !safeEncodings.includes(encoding);
                const message = isProblematic
                    ? `⚠️ This file is detected as ${encoding}. Saving in VS Code's default (UTF-8) may corrupt special characters.`
                    : `✓ This file is ${encoding} (safe).`;

                vscode.window.showInformationMessage(
                    message,
                    'Change Encoding...'
                ).then(selection => {
                    if (selection === 'Change Encoding...') {
                        // This command opens VS Code's native "Reopen with Encoding" / "Save with Encoding" menu
                        vscode.commands.executeCommand('workbench.action.editor.changeEncoding');
                    }
                });
            }
        }
    );

    context.subscriptions.push(showInfoCommand);
}

function getSafeEncodings(): string[] {
    const config = vscode.workspace.getConfiguration('encodingDetector');
    return config.get<string[]>('safeEncodings', ['ascii', 'utf-8']).map(e => e.toLowerCase());
}

function shouldProcessDocument(document: vscode.TextDocument): boolean {
    // Only process actual files on disk, ignore untitled, settings, etc.
    return document.uri.scheme === 'file';
}

async function detectAndShowEncoding(document: vscode.TextDocument): Promise<void> {
    const filePath = document.uri.fsPath;
    
    statusBarItem.text = '$(sync~spin) Detecting...';
    statusBarItem.tooltip = 'Checking file encoding';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.show();

    const encoding = await detectEncoding(filePath);
    
    if (encoding) {
        fileEncodings.set(filePath, encoding);
        updateStatusBar(encoding);
    } else {
        statusBarItem.text = '$(question) Encoding Unknown';
        statusBarItem.tooltip = 'Could not detect file encoding';
    }
}

function updateStatusBar(encoding: string): void {
    const safeEncodings = getSafeEncodings();
    const isProblematic = !safeEncodings.includes(encoding);
    
    if (isProblematic) {
        statusBarItem.text = `$(alert) ${encoding}`;
        statusBarItem.tooltip = `⚠️ Encoding: ${encoding}\nClick for options.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.text = `$(check) ${encoding}`;
        statusBarItem.tooltip = `Encoding: ${encoding}`;
        statusBarItem.backgroundColor = undefined;
    }
    
    statusBarItem.show();
}

async function detectEncoding(filePath: string): Promise<string | null> {
    return new Promise((resolve) => {
        const pythonScript = `
import sys
import chardet
try:
    with open(sys.argv[1], 'rb') as f:
        # Read a chunk of the file, not the whole thing for performance
        raw_data = f.read(10240) 
        result = chardet.detect(raw_data)
        if result and result['encoding']:
            print(result['encoding'])
        else:
            print('unknown')
except Exception as e:
    print(f'error: {e}', file=sys.stderr)
`;
        const python = spawn('python3', ['-c', pythonScript, filePath]);
        let output = '';
        let errorOutput = '';

        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { errorOutput += data.toString(); });

        python.on('close', (code) => {
            if (code === 0 && output.trim() && output.trim() !== 'unknown') {
                resolve(output.trim().toLowerCase());
            } else {
                console.error(`Encoding detection failed for ${filePath}: ${errorOutput}`);
                resolve(null);
            }
        });

        // Fail after 5 seconds
        setTimeout(() => {
            if (!python.killed) {
                python.kill();
                console.error(`Encoding detection timed out for ${filePath}`);
                resolve(null);
            }
        }, 5000);
    });
}

export function deactivate() {
    fileEncodings.clear();
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
