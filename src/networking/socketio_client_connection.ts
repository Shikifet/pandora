import { GetLogger, IShardClient } from 'pandora-common';
import type { Socket } from 'socket.io';
import { ConnectionType, IConnectionClient } from './common';
import ConnectionManagerClient from './manager_client';
import { SocketIOConnection } from './socketio_common_connection';

/** Class housing connection from a client */
export class SocketIOConnectionClient extends SocketIOConnection<IShardClient> implements IConnectionClient {
	readonly type: ConnectionType.CLIENT = ConnectionType.CLIENT;

	get id(): string {
		return this.socket.id;
	}

	constructor(socket: Socket) {
		super(socket, GetLogger('Connection-Client', `[Connection-Client ${socket.id}]`));
		ConnectionManagerClient.onConnect(this, socket.handshake.auth);
	}

	/** Handler for when client disconnects */
	protected override onDisconnect(_reason: string): void {
		ConnectionManagerClient.onDisconnect(this);
	}

	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected override onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean> {
		return ConnectionManagerClient.messageHandler.onMessage(messageType, message, callback, this);
	}
}
