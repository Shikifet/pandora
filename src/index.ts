import { mkdirSync } from 'fs';
import { APP_NAME, APP_VERSION } from './config';
import { AddFileOutput } from './logging';
import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common';
import { ConnectToDirectory } from './networking/socketio_directory_connector';
import { StartHttpServer } from './networking/httpServer';
import { InitDatabase } from './database/databaseProvider';
import { SetupSignalHandling } from './lifecycle';
import { LoadAssetDefinitions } from './assets/assetManager';
// get version from package.json

const LOG_DIR = './logs';
const logger = GetLogger('init');

Start().catch((error) => {
	logger.fatal('Init failed:', error);
});

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	SetupSignalHandling();
	SetupLogging();
	logger.info(`${APP_NAME} v${APP_VERSION} starting...`);
	logger.debug('Loading asset definitions...');
	LoadAssetDefinitions();
	logger.debug('Connecting to Directory...');
	await ConnectToDirectory();
	logger.debug('Initializing database...');
	await InitDatabase();
	logger.debug('Starting HTTP server...');
	await StartHttpServer();
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
	mkdirSync(LOG_DIR, { recursive: true });
	SetConsoleOutput(LogLevel.DEBUG);
	AddFileOutput(`${LOG_DIR}/debug.log`, false, LogLevel.DEBUG);
	AddFileOutput(`${LOG_DIR}/error.log`, true, LogLevel.ALERT);
}
