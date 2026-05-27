import * as extensionApi from '@podman-desktop/api';
import * as path from 'node:path';
import * as fs from 'node:fs';

const THEMES = ['dark', 'light', 'hc-dark', 'hc-light'] as const;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(outputPath: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BrowserWindow, nativeImage } = require('electron');
  const windows = BrowserWindow.getAllWindows();

  if (windows.length === 0) {
    throw new Error('No Podman Desktop window found');
  }

  const mainWindow = windows[0];
  const image = await mainWindow.webContents.capturePage();
  await fs.promises.writeFile(outputPath, image.toPNG());
}

function setNativeTheme(theme: string): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { nativeTheme } = require('electron');
  if (theme === 'light' || theme === 'hc-light') {
    nativeTheme.themeSource = 'light';
  } else if (theme === 'dark' || theme === 'hc-dark') {
    nativeTheme.themeSource = 'dark';
  } else {
    nativeTheme.themeSource = 'system';
  }
}

async function getOutputFolder(): Promise<string | undefined> {
  const extConfig = extensionApi.configuration.getConfiguration('screenshot-themes');
  const saved = extConfig.get<string>('outputFolder');

  if (saved) {
    return saved;
  }

  const result = await extensionApi.window.showOpenDialog({
    title: 'Select output directory for screenshots',
    selectors: ['openDirectory'],
  });

  if (!result || result.length === 0) {
    return undefined;
  }

  const folder = result[0].fsPath;
  await extConfig.update('outputFolder', folder);
  return folder;
}

async function captureAllThemes(): Promise<void> {
  const outputDir = await getOutputFolder();
  if (!outputDir) {
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);

  const config = extensionApi.configuration.getConfiguration('preferences');
  const originalTheme = config.get<string>('appearance') ?? 'system';

  await extensionApi.window.withProgress(
    { location: extensionApi.ProgressLocation.TASK_WIDGET, title: 'Capturing theme screenshots' },
    async progress => {
      for (const theme of THEMES) {
        progress.report({ message: `Switching to ${theme}...` });

        await config.update('appearance', theme);
        setNativeTheme(theme);
        await delay(1000);

        const outputPath = path.join(outputDir, `${timestamp}-screenshot-${theme}.png`);
        try {
          await takeScreenshot(outputPath);
          progress.report({ message: `Captured ${theme}` });
        } catch (err) {
          console.error(`Failed to capture ${theme} screenshot:`, err);
          await extensionApi.window.showErrorMessage(
            `Failed to capture ${theme} screenshot: ${String(err)}`,
          );
        }

        await delay(500);
      }

      progress.report({ message: 'Restoring original theme...' });
      await config.update('appearance', originalTheme);
      setNativeTheme(originalTheme);

      await extensionApi.window.showInformationMessage(
        `Screenshots saved to ${outputDir}`,
      );
    },
  );
}

export async function activate(extensionContext: extensionApi.ExtensionContext): Promise<void> {
  console.log('starting screenshot-themes extension');

  const command = extensionApi.commands.registerCommand(
    'screenshot.captureAllThemes',
    captureAllThemes,
  );
  extensionContext.subscriptions.push(command);

  const statusBarItem = extensionApi.window.createStatusBarItem(
    extensionApi.StatusBarAlignLeft,
    -100,
  );

  // Leave title blank so it doesn't take up space
  statusBarItem.text = '';
  statusBarItem.tooltip = 'Capture screenshots in all 4 themes (dark, light, hc-dark, hc-light)';
  statusBarItem.iconClass = 'fa fa-camera';
  statusBarItem.command = 'screenshot.captureAllThemes';
  statusBarItem.show();
  extensionContext.subscriptions.push(statusBarItem);
}

export async function deactivate(): Promise<void> {
  console.log('stopping screenshot-themes extension');
}
