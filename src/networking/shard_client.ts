import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { MessageHandler } from './message_handler';
import type { CharacterId, ICharacterData, ICharacterPublicData } from '../character';
import { IChatRoomFullInfo } from '../chatroom';
import { AssetsDefinitionFile } from '../assets/definitions';
import { IChatRoomMessage } from '../chatroom/chat';

export type IChatRoomClientData = IChatRoomFullInfo & {
	characters: ICharacterPublicData[];
};

export type IChatRoomUpdate = {
	room: null | IChatRoomClientData;
} | {
	info?: Partial<IChatRoomClientData>;
	leave?: CharacterId;
	join?: ICharacterPublicData;
	update?: Pick<ICharacterPublicData, 'id'> & Partial<ICharacterPublicData>;
};

/** Shard->Client handlers */
interface ShardClient {
	load: (args: {
		character: ICharacterData;
		room: null | IChatRoomClientData;
		assetsDefinition: AssetsDefinitionFile;
		assetsDefinitionHash: string;
		assetsSource: string;
	}) => void;
	updateCharacter: (args: Partial<ICharacterData>) => void;
	chatRoomUpdate(args: IChatRoomUpdate): void;
	chatRoomMessage(arg: {
		messages: IChatRoomMessage[];
	}): void;
}

export type IShardClient = SocketInterface<ShardClient>;
export type IShardClientArgument = RecordOnly<SocketInterfaceArgs<ShardClient>>;
export type IShardClientUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<ShardClient>;
export type IShardClientResult = SocketInterfaceResult<ShardClient>;
export type IShardClientPromiseResult = SocketInterfacePromiseResult<ShardClient>;
export type IShardClientNormalResult = SocketInterfaceNormalResult<ShardClient>;
export type IShardClientResponseHandler = SocketInterfaceResponseHandler<ShardClient>;
export type IShardClientOneshotHandler = SocketInterfaceOneshotHandler<ShardClient>;
export type IShardClientMessageHandler<Context> = MessageHandler<ShardClient, Context>;
export type IShardClientBase = ShardClient;
