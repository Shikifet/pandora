import { ZodConnection, GetLogger, IDirectoryShardBase, IncomingSocket, IServerSocket, ShardDirectoryInSchema } from 'pandora-common';
import { ConnectionType, IConnectionShard } from './common';
import { ConnectionManagerShard } from './manager_shard';
import { Shard } from '../shard/shard';

/** Class housing connection from a shard */
export class ShardConnection extends ZodConnection<IncomingSocket, typeof ShardDirectoryInSchema, IDirectoryShardBase> implements IConnectionShard {
	readonly type: ConnectionType.SHARD = ConnectionType.SHARD;

	public shard: Shard | null = null;

	constructor(server: IServerSocket<IDirectoryShardBase>, socket: IncomingSocket) {
		super(server, socket, GetLogger('Connection-Shard', `[Connection-Shard ${socket.id}]`), ShardDirectoryInSchema);
		this.logger.verbose('Connected');
	}

	protected override onDisconnect(reason: string): void {
		this.logger.verbose('Disconnected, reason:', reason);
		ConnectionManagerShard.onDisconnect(this);
	}

	protected override onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean> {
		return ConnectionManagerShard.onMessage(messageType, message, callback, this);
	}
}
