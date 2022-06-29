import { ErrorInfo } from 'react';
import { GAME_VERSION } from '../../config/Environment';
import { DirectoryConnectionState } from '../../networking/directoryConnector';
import { ShardConnectionState } from '../../networking/shardConnector';
import { DebugData } from './debugContextProvider';
import { utils } from 'pixi.js';

interface ReportSection {
	heading: string;
	details: string;
}

export const MAX_ERROR_STACK_LINES = 20;

export function BuildErrorReport(error: unknown, errorInfo: ErrorInfo, debugData: DebugData): string {
	try {
		const report = [
			BuildStackTraceSection(error),
			BuildComponentStackSection(errorInfo),
			BuildDirectoryDataSection(debugData),
			BuildShardDataSection(debugData),
			BuildDiagnosticsSection(),
			BuildDeviceSection(),
		]
			.map(DisplayReportSection)
			.join('\n\n');
		return '```\n' + report + '\n```';
	} catch (_) {
		return `${ String(error) }\n${ String(errorInfo) }\n${ String(debugData) }`;
	}
}

function BuildStackTraceSection(error: unknown): ReportSection {
	let details: string;
	if (error instanceof Error && error.stack) {
		const errorSummary = `${ error.name }: ${ error.message }`;
		const stack = TruncateStack(error.stack);
		if (!stack.startsWith(errorSummary)) {
			details = `${ errorSummary }\n${ stack }`;
		} else {
			details = stack;
		}
	} else {
		details = String(error);
	}
	return { heading: 'Error Stack', details };
}

function BuildComponentStackSection(errorInfo?: ErrorInfo): ReportSection {
	const details = TruncateStack(errorInfo?.componentStack ?? '').replace(/^\s*/, '');
	return { heading: 'Component Stack', details };
}

function BuildDirectoryDataSection(debugData: DebugData): ReportSection {
	let details = '';
	if (debugData) {
		if (debugData.editor) {
			return { heading: 'Editor', details: 'Editor is running' };
		}
		const { directoryState, directoryStatus } = debugData;
		details += `Directory state: ${ directoryState ? DirectoryConnectionState[directoryState] : 'unknown' }\n`;
		details += 'Directory status:';
		let directoryStatusString: string;
		try {
			directoryStatusString = JSON.stringify(directoryStatus, null, 4);
		} catch (_) {
			directoryStatusString = String(directoryStatus);
		}
		details += directoryStatusString ? `\n${ directoryStatusString }` : ' unavailable';
	}
	return { heading: 'Directory Information', details };
}

function BuildShardDataSection(debugData: DebugData): ReportSection {
	let details = '';
	if (debugData) {
		const { shardState, shardConnectionInfo } = debugData;
		details += `Shard state: ${ shardState ? ShardConnectionState[shardState] : 'unknown' }\n`;
		details += 'Shard connection information:';
		let connectionInfoString: string;
		try {
			connectionInfoString = JSON.stringify(shardConnectionInfo, null, 4);
		} catch (_) {
			connectionInfoString = String(shardConnectionInfo);
		}
		details += connectionInfoString ? `\n${ connectionInfoString }` : ' unavailable';
	}
	return { heading: 'Shard Information', details };
}

function BuildDiagnosticsSection(): ReportSection {
	const details = [
		`Location: ${ window.location.href }`,
		`User agent: ${ window.navigator.userAgent }`,
		`Game version: ${ GAME_VERSION }`,
		`Local time: ${ Date.now() }`,
		`WebGL supported: ${ String(utils.isWebGLSupported()) }`,
	].join('\n');
	return { heading: 'Additional Diagnostics', details };
}

function BuildDeviceSection(): ReportSection {
	return { heading: 'Device details', details: JSON.stringify(utils.isMobile, null, 4) };
}

function TruncateStack(stack: string): string {
	let lines = stack.split('\n');
	const fullStackSize = lines.length;
	if (fullStackSize > MAX_ERROR_STACK_LINES) {
		lines = lines.slice(0, MAX_ERROR_STACK_LINES);
		lines.push(`    ...and ${ fullStackSize - MAX_ERROR_STACK_LINES } more`);
	}
	return lines.join('\n');
}

function DisplayReportSection({ heading, details }: ReportSection): string {
	const headingDecoration = '-'.repeat(heading.length);
	return `${ headingDecoration }\n${ heading }\n${ headingDecoration }\n${ details }`;
}
