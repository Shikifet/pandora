import {
	CharacterId,
	ConnectionBase,
	CreateMessageHandlerOnAny,
	GetLogger,
	IClientShardBase,
	IDirectoryCharacterConnectionInfo,
	IShardClientArgument,
	IShardClientBase,
	MessageHandler,
} from 'pandora-common';
import { connect, Socket } from 'socket.io-client';
import { LoadAssetDefinitions } from '../assets/assetManager';
import { BrowserStorage } from '../browserStorage';
import { PlayerCharacter } from '../character/player';
import type { IChatRoomHandler } from '../components/gameContext/chatRoomContextProvider';
import { Observable, ReadonlyObservable } from '../observable';
import { PersistentToast } from '../persistentToast';
import { ShardConnector, ShardConnectionState } from './shardConnector';

const logger = GetLogger('ShardConn');

/** Used for auto-reconnect to character after window refresh */
export const LastSelectedCharacter = BrowserStorage.createSession<CharacterId | undefined>('lastSelectedCharacter', undefined);

function CreateConnection({ publicURL, secret, characterId }: IDirectoryCharacterConnectionInfo): Socket {
	// Create the connection without connecting
	return connect(publicURL, {
		autoConnect: false,
		withCredentials: true,
		extraHeaders: {
			authorization: `${characterId} ${secret}`,
		},
	});
}

const ShardConnectionProgress = new PersistentToast();

/** Class housing connection from Shard to Shard */
export class SocketIOShardConnector extends ConnectionBase<Socket, IClientShardBase> implements ShardConnector {

	private readonly _state: Observable<ShardConnectionState> = new Observable<ShardConnectionState>(ShardConnectionState.NONE);
	private readonly _connectionInfo: Observable<IDirectoryCharacterConnectionInfo>;
	private readonly _room: IChatRoomHandler;
	private readonly _player: { value: PlayerCharacter | null };

	private loadResolver: ((arg: this) => void) | null = null;

	/** Current state of the connection */
	get state(): ReadonlyObservable<ShardConnectionState> {
		return this._state;
	}

	get connectionInfo(): ReadonlyObservable<Readonly<IDirectoryCharacterConnectionInfo>> {
		return this._connectionInfo;
	}

	constructor(info: IDirectoryCharacterConnectionInfo, player: { value: PlayerCharacter | null }, room: IChatRoomHandler) {
		super(CreateConnection(info), logger);
		this._connectionInfo = new Observable<IDirectoryCharacterConnectionInfo>(info);
		this._player = player;
		this._room = room;

		// Setup event handlers
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('connect_error', this.onConnectError.bind(this));

		// Setup message handler
		const handler = new MessageHandler<IShardClientBase>({}, {
			load: this.onLoad.bind(this),
			updateCharacter: this.onUpdateCharacter.bind(this),
			chatRoomUpdate: (data: IShardClientArgument['chatRoomUpdate']) => {
				this._room.onUpdate(data);
			},
			chatRoomMessage: (message: IShardClientArgument['chatRoomMessage']) => {
				const lastTime = this._room.onMessage(message.messages);
				if (lastTime > 0) {
					this.sendMessage('chatRoomMessageAck', { lastTime });
				}
			},
			chatRoomStatus: (status: IShardClientArgument['chatRoomStatus']) => {
				this._room.onStatus(status);
			},
		});
		this.socket.onAny(CreateMessageHandlerOnAny(logger, handler.onMessage.bind(handler)));
	}

	public connectionInfoMatches(info: IDirectoryCharacterConnectionInfo): boolean {
		const { id, publicURL, version, characterId, secret } = this._connectionInfo.value;
		return id === info.id &&
			publicURL === info.publicURL &&
			// features === info.features &&
			version === info.version &&
			characterId === info.characterId &&
			secret === info.secret;
	}

	/**
	 * Attempt a connection
	 *
	 * **can only be used once**
	 * @returns Promise of the connection
	 */
	public connect(): Promise<this> {
		if (this._state.value !== ShardConnectionState.NONE) {
			throw new Error('connect can only be called once');
		}
		return new Promise((resolve) => {
			this.setState(ShardConnectionState.INITIAL_CONNECTION_PENDING);
			this.loadResolver = resolve;
			// Attempt to connect
			this.socket.connect();
		});
	}

	/** Disconnect from Shard */
	public disconnect(): void {
		if (this._state.value === ShardConnectionState.NONE) {
			this.setState(ShardConnectionState.DISCONNECTED);
			return;
		}
		if (this._state.value === ShardConnectionState.DISCONNECTED)
			return;
		this.socket.close();
		this.setState(ShardConnectionState.DISCONNECTED);
		logger.info('Disconnected from Shard');
	}

	/**
	 * Sets a new state, updating all dependent things
	 * @param newState The state to set
	 */
	private setState(newState: ShardConnectionState): void {
		this._state.value = newState;

		if (newState === ShardConnectionState.INITIAL_CONNECTION_PENDING) {
			ShardConnectionProgress.show('progress', 'Connecting to Shard...');
		} else if (newState === ShardConnectionState.WAIT_FOR_DATA) {
			ShardConnectionProgress.show('progress', 'Loading Shard data...');
		} else if (newState === ShardConnectionState.CONNECTED) {
			ShardConnectionProgress.show('success', 'Connected to Shard');
		} else if (newState === ShardConnectionState.CONNECTION_LOST) {
			ShardConnectionProgress.show('progress', 'Shard connection lost\nReconnecting...');
		} else if (newState === ShardConnectionState.DISCONNECTED) {
			ShardConnectionProgress.hide();
		}
	}

	/** Handle successful connection to Shard */
	private onConnect(): void {
		const currentState = this._state.value;
		if (currentState === ShardConnectionState.INITIAL_CONNECTION_PENDING) {
			this.setState(ShardConnectionState.WAIT_FOR_DATA);
			logger.info('Connected to Shard');
		} else if (currentState === ShardConnectionState.CONNECTION_LOST) {
			this.setState(ShardConnectionState.WAIT_FOR_DATA);
			logger.alert('Re-Connected to Shard');
		} else {
			logger.fatal('Assertion failed: received \'connect\' event when in state:', ShardConnectionState[currentState]);
		}
	}

	/** Handle loss of connection to Shard */
	private onDisconnect(reason: Socket.DisconnectReason) {
		const currentState = this._state.value;
		// If the disconnect was requested, just ignore this
		if (currentState === ShardConnectionState.DISCONNECTED)
			return;
		if (currentState === ShardConnectionState.CONNECTED) {
			this.setState(ShardConnectionState.CONNECTION_LOST);
			logger.alert('Lost connection to Shard:', reason);
		} else {
			logger.fatal('Assertion failed: received \'disconnect\' event when in state:', ShardConnectionState[currentState]);
		}
	}

	/** Handle failed connection attempt */
	private onConnectError(err: Error) {
		logger.warning('Connection to Shard failed:', err.message);
	}

	private onLoad({ character, room, assetsDefinition, assetsDefinitionHash, assetsSource }: IShardClientArgument['load']): void {
		const currentState = this._state.value;
		LoadAssetDefinitions(assetsDefinitionHash, assetsDefinition, assetsSource);
		if (this._player.value?.data.id === character.id) {
			this._player.value.update(character);
		} else {
			this._player.value = new PlayerCharacter(character);
		}
		this._room.onUpdate({ room });
		if (currentState === ShardConnectionState.CONNECTED) {
			// Ignore reloads from shard
		} else if (currentState === ShardConnectionState.WAIT_FOR_DATA) {
			this.setState(ShardConnectionState.CONNECTED);
			if (this.loadResolver) {
				this.loadResolver(this);
				this.loadResolver = null;
			}
			logger.info('Received initial character data');
		} else {
			logger.fatal('Assertion failed: received \'load\' event when in state:', ShardConnectionState[currentState]);
		}
	}

	private onUpdateCharacter(data: IShardClientArgument['updateCharacter']): void {
		if (!this._player.value) {
			throw new Error('Received update data without player');
		}
		this._player.value.update(data);
	}
}

