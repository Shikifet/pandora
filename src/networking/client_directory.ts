import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { IDirectoryAccountInfo } from './directory_client';
import type { ShardFeature } from './shard_directory';
import type { MessageHandler } from './message_handler';
import type { IEmpty } from './empty';
import type { CharacterId, ICharacterDataId, ICharacterSelfInfo, ICharacterSelfInfoUpdate } from '../character';

export type ShardInfo = {
	id: string;
	publicURL: string;
	features: ShardFeature[];
	version: string;
	secret: string;
};

type ShardError = 'noShardFound';

type ShardConnection<T = ShardError, Extra = IEmpty> = {
	result: T;
} | ({
	result: 'ok';
} & ShardInfo & Extra);

/** Client->Directory handlers */
interface ClientDirectory {
	//#region Before Login
	login(arg: { username: string; passwordSha512: string; verificationToken?: string; }): {
		result: 'verificationRequired' | 'invalidToken' | 'unknownCredentials',
	} | {
		result: 'ok',
		token: { value: string; expires: number; },
		account: IDirectoryAccountInfo,
	};
	register(arg: { username: string; passwordSha512: string; email: string; }): {
		result: 'ok' | 'usernameTaken' | 'emailTaken',
	};
	resendVerificationEmail(arg: { email: string; }): {
		result: 'maybeSent',
	};
	passwordReset(arg: { email: string; }): {
		result: 'maybeSent',
	};
	passwordResetConfirm(arg: { username: string; passwordSha512: string; token: string; }): {
		result: 'ok' | 'unknownCredentials',
	};
	//#endregion Before Login
	passwordChange(arg: { passwordSha512Old: string; passwordSha512New: string; }): {
		result: 'ok' | 'invalidPassword',
	};
	logout(arg: { invalidateToken?: string; }): void;

	listCharacters(_: IEmpty): {
		characters: ICharacterSelfInfo[];
		limit: number;
	};
	createCharacter(_: IEmpty): ShardConnection<ShardError | 'maxCharactersReached', { characterId: CharacterId; }>;
	updateCharacter(arg: ICharacterSelfInfoUpdate): ICharacterSelfInfo;
	deleteCharacter(arg: ICharacterDataId): { result: 'ok' | 'characterInUse'; };
	connectCharacter(arg: ICharacterDataId): ShardConnection;
}

export type IClientDirectory = SocketInterface<ClientDirectory>;
export type IClientDirectoryArgument = RecordOnly<SocketInterfaceArgs<ClientDirectory>>;
export type IClientDirectoryUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<ClientDirectory>;
export type IClientDirectoryResult = SocketInterfaceResult<ClientDirectory>;
export type IClientDirectoryPromiseResult = SocketInterfacePromiseResult<ClientDirectory>;
export type IClientDirectoryNormalResult = SocketInterfaceNormalResult<ClientDirectory>;
export type IClientDirectoryResponseHandler = SocketInterfaceResponseHandler<ClientDirectory>;
export type IClientDirectoryOneshotHandler = SocketInterfaceOneshotHandler<ClientDirectory>;
export type IClientDirectoryMessageHandler<Context> = MessageHandler<ClientDirectory, Context>;
export type IClientDirectoryBase = ClientDirectory;
