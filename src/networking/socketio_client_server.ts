import type { Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { GetLogger } from 'pandora-common/dist/logging';
import { SocketIOServer } from './socketio_common_server';
import { SocketIOConnectionClient } from './socketio_client_connection';

const logger = GetLogger('SIO-Server-Client');

/** Class housing socket.io endpoint for clients */
export class SocketIOServerClient extends SocketIOServer {

	constructor(httpServer: HttpServer) {
		super(httpServer, {});
	}

	/**
	 * Handle new incoming connections
	 * @param socket - The newly connected socket
	 */
	protected onConnect(socket: Socket): SocketIOConnectionClient {
		const connection = new SocketIOConnectionClient(socket);
		if (!connection.isConnected()) {
			logger.fatal('Asserting failed: client disconnect before onConnect finished');
		}
		return connection;
	}
}
