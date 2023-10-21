import type { SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';
import { AccountCryptoKeySchema, DirectoryAccountSettingsSchema, IDirectoryAccountInfo, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryDirectMessageInfo, IDirectoryShardInfo } from './directory_client';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes';
import { ICharacterSelfInfo } from '../character/characterData';
import { ChatRoomDirectoryConfigSchema, ChatRoomDirectoryUpdateSchema, IChatRoomListExtendedInfo, IChatRoomListInfo, RoomId, RoomIdSchema } from '../chatroom/room';
import { AccountId, AccountIdSchema, ConfiguredAccountRoleSchema, IAccountRoleManageInfo } from '../account';
import { EmailAddressSchema, PasswordSha512Schema, SimpleTokenSchema, UserNameSchema, ZodCast } from '../validation';
import { z } from 'zod';
import { Satisfies } from '../utility';

// Fix for pnpm resolution weirdness
import type { } from '../account/accountRoles';

type ShardError = 'noShardFound' | 'failed';

export const ClientDirectoryAuthMessageSchema = z.object({
	username: UserNameSchema,
	token: z.string(),
	character: z.object({
		id: CharacterIdSchema,
		secret: z.string(),
	}).nullable(),
});

export type IClientDirectoryAuthMessage = z.infer<typeof ClientDirectoryAuthMessageSchema>;

export const ShardTokenTypeSchema = z.enum(['stable', 'beta', 'testing', 'development']);
export type IShardTokenType = z.infer<typeof ShardTokenTypeSchema>;

export type IBaseTokenInfo = Readonly<{
	id: string;
	expires?: number;
	created: Readonly<{
		id: number;
		username: string;
		time: number;
	}>;
}>;

export type IShardTokenInfo = IBaseTokenInfo & {
	readonly type: IShardTokenType;
};

export type IShardTokenConnectInfo = IShardTokenInfo & {
	connected?: number;
};

export type IBetaKeyInfo = IBaseTokenInfo & {
	readonly maxUses?: number;
	uses: number;
};

export type IChatRoomExtendedInfoResponse = {
	result: 'notFound' | 'noAccess';
} | {
	result: 'success';
	data: IChatRoomListExtendedInfo;
};

export type IAccountRelationship = {
	/** Account id of the other account */
	id: AccountId;
	/** Account name of the other account */
	name: string;
	/** Time the relationship was updated */
	time: number;
	/** Type of relationship */
	type: 'friend' | 'pending' | 'incoming' | 'blocked';
};

export type IAccountFriendStatus = {
	/** Account id of the friend */
	id: AccountId;
	/** If the friend is online */
	online: boolean;
	/** List of online characters the friend has */
	characters?: {
		id: CharacterId;
		name: string;
		inRoom?: RoomId;
	}[];
};

/** Client->Directory messages */
export const ClientDirectorySchema = {
	//#region Before Login
	login: {
		request: z.object({
			username: UserNameSchema,
			passwordSha512: PasswordSha512Schema,
			verificationToken: SimpleTokenSchema.optional(),
		}),
		response: ZodCast<{ result: 'verificationRequired' | 'invalidToken' | 'unknownCredentials'; } | {
			result: 'ok';
			token: { value: string; expires: number; };
			account: IDirectoryAccountInfo;
		}>(),
	},
	register: {
		request: z.object({
			username: UserNameSchema,
			passwordSha512: PasswordSha512Schema,
			email: EmailAddressSchema,
			betaKey: z.string().optional(),
			captchaToken: z.string().optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'usernameTaken' | 'emailTaken' | 'invalidBetaKey' | 'invalidCaptcha'; }>(),
	},
	resendVerificationEmail: {
		request: z.object({
			email: EmailAddressSchema,
			captchaToken: z.string().optional(),
		}),
		response: ZodCast<{ result: 'maybeSent' | 'invalidCaptcha'; }>(),
	},
	passwordReset: {
		request: z.object({
			email: EmailAddressSchema,
			captchaToken: z.string().optional(),
		}),
		response: ZodCast<{ result: 'maybeSent' | 'invalidCaptcha'; }>(),
	},
	passwordResetConfirm: {
		request: z.object({
			username: UserNameSchema,
			passwordSha512: PasswordSha512Schema,
			token: SimpleTokenSchema,
		}),
		response: ZodCast<{ result: 'ok' | 'unknownCredentials'; }>(),
	},
	//#endregion Before Login

	//#region Account management
	passwordChange: {
		request: z.object({
			passwordSha512Old: PasswordSha512Schema,
			passwordSha512New: PasswordSha512Schema,
			cryptoKey: AccountCryptoKeySchema,
		}),
		response: ZodCast<{ result: 'ok' | 'invalidPassword'; }>(),
	},
	logout: {
		request: z.object({
			invalidateToken: z.string().optional(),
		}),
		response: null,
	},
	gitHubBind: {
		request: z.object({
			login: z.string(),
		}),
		response: ZodCast<{ url: string; }>(),
	},
	gitHubUnbind: {
		request: z.object({}),
		response: null,
	},
	changeSettings: {
		request: DirectoryAccountSettingsSchema.partial(),
		response: null,
	},
	setCryptoKey: {
		request: z.object({
			cryptoKey: AccountCryptoKeySchema,
		}),
		response: null,
	},
	//#endregion

	getRelationships: {
		request: z.object({}),
		response: ZodCast<{
			relationships: IAccountRelationship[];
			friends: IAccountFriendStatus[];
		}>(),
	},

	//#region Character management
	listCharacters: {
		request: z.object({}),
		response: ZodCast<{
			characters: ICharacterSelfInfo[];
			limit: number;
		}>(),
	},
	createCharacter: {
		request: z.object({}),
		response: ZodCast<{ result: 'ok' | 'maxCharactersReached' | ShardError; }>(),
	},
	updateCharacter: {
		request: z.object({
			id: CharacterIdSchema,
			preview: z.string().optional(),
		}),
		response: ZodCast<ICharacterSelfInfo>(),
	},
	deleteCharacter: {
		request: z.object({
			id: CharacterIdSchema,
		}),
		response: ZodCast<{ result: 'ok' | 'characterInUse'; }>(),
	},
	//#endregion

	//#region Character connection, shard interaction
	connectCharacter: {
		request: z.object({
			id: CharacterIdSchema,
		}),
		response: ZodCast<{ result: 'ok' | ShardError; }>(),
	},
	disconnectCharacter: {
		request: z.object({}),
		response: null,
	},
	shardInfo: {
		request: z.object({}),
		response: ZodCast<{ shards: IDirectoryShardInfo[]; }>(),
	},
	listRooms: {
		request: z.object({}),
		response: ZodCast<{ rooms: IChatRoomListInfo[]; }>(),
	},
	chatRoomGetInfo: {
		request: z.object({
			id: RoomIdSchema,
		}),
		response: ZodCast<IChatRoomExtendedInfoResponse>(),
	},
	chatRoomCreate: {
		request: ChatRoomDirectoryConfigSchema,
		response: ZodCast<{ result: 'ok' | 'roomOwnershipLimitReached' | ShardError; }>(),
	},
	chatRoomEnter: {
		request: z.object({
			id: RoomIdSchema,
			password: z.string().optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'failed' | 'errFull' | 'notFound' | 'noAccess' | 'invalidPassword'; }>(),
	},
	chatRoomLeave: {
		request: z.object({}),
		response: z.object({
			result: z.enum(['ok', 'failed', 'restricted', 'inRoomDevice']),
		}),
	},
	chatRoomUpdate: {
		request: ChatRoomDirectoryUpdateSchema,
		response: ZodCast<{ result: 'ok' | 'notInRoom' | 'noAccess'; }>(),
	},
	chatRoomAdminAction: {
		request: z.object({
			action: z.enum(['kick', 'ban', 'unban', 'promote', 'demote']),
			targets: z.array(AccountIdSchema),
		}),
		response: null,
	},
	chatRoomOwnershipRemove: {
		request: z.object({
			id: RoomIdSchema,
		}),
		response: ZodCast<{ result: 'ok' | 'notAnOwner'; }>(),
	},
	//#endregion

	getDirectMessages: {
		request: z.object({
			id: AccountIdSchema,
			until: z.number().min(0).optional(),
		}),
		response: ZodCast<{ result: 'notFound' | 'denied'; } | {
			result: 'ok';
			account: IDirectoryDirectMessageAccount;
			messages: IDirectoryDirectMessage[];
		}>(),
	},
	sendDirectMessage: {
		request: z.object({
			id: AccountIdSchema,
			content: z.string(),
			editing: z.number().min(0).optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound' | 'denied' | 'messageNotFound'; }>(),
	},
	directMessage: {
		request: z.object({
			id: AccountIdSchema,
			action: z.enum(['read', 'close']),
		}),
		response: null,
	},
	getDirectMessageInfo: {
		request: z.object({}),
		response: ZodCast<{ info: IDirectoryDirectMessageInfo[]; }>(),
	},
	friendRequest: {
		request: z.object({
			id: AccountIdSchema,
			action: z.enum(['initiate', 'accept', 'decline', 'cancel']),
		}),
		response: ZodCast<{
			result: 'ok' | 'accountNotFound' | 'requestNotFound' | 'blocked' | 'requestAlreadyExists';
		}>(),
	},
	unfriend: {
		request: z.object({
			id: AccountIdSchema,
		}),
		response: ZodCast<{
			result: 'ok' | 'accountNotFound';
		}>(),
	},
	blockList: {
		request: z.object({
			id: AccountIdSchema,
			action: z.enum(['add', 'remove']),
		}),
		response: null,
	},

	//#region Management/admin endpoints; these require specific roles to be used

	// Account role assignment
	manageGetAccountRoles: {
		request: z.object({
			id: z.number(),
		}),
		response: ZodCast<{ result: 'notFound'; } | {
			result: 'ok';
			roles: IAccountRoleManageInfo;
		}>(),
	},
	manageSetAccountRole: {
		request: z.object({
			id: z.number(),
			role: ConfiguredAccountRoleSchema,
			expires: z.number().optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound'; }>(),
	},

	// Shard token management
	manageCreateShardToken: {
		request: z.object({
			/**
			 * Type of the token to create.
			 * stable/beta requires admin role.
			 *
			 * each type has required role to access it:
			 * stable: none
			 * beta: developer, contributor, supporter
			 * testing: developer, contributor
			 * development: developer
			 */
			type: ShardTokenTypeSchema,
			/**
			 * If set, the token will expire at this time.
			 * If not set, the token will never expire.
			 * Directory may change this value.
			 */
			expires: z.number().optional(),
		}),
		response: ZodCast<{ result: 'adminRequired'; } | {
			result: 'ok';
			info: IShardTokenInfo;
			token: string;
		}>(),
	},
	manageInvalidateShardToken: {
		request: z.object({
			id: z.string(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound' | 'adminRequired'; }>(),
	},
	manageListShardTokens: {
		request: z.object({}),
		response: ZodCast<{ info: IShardTokenConnectInfo[]; }>(),
	},
	manageCreateBetaKey: {
		request: z.object({
			expires: z.number().optional(),
			maxUses: z.number().optional(),
		}),
		response: ZodCast<{ result: 'adminRequired'; } | {
			result: 'ok';
			info: IBetaKeyInfo;
			token: string;
		}>(),
	},
	manageListBetaKeys: {
		request: z.object({}),
		response: ZodCast<{ keys: IBetaKeyInfo[]; }>(),
	},
	manageInvalidateBetaKey: {
		request: z.object({
			id: z.string(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound' | 'adminRequired'; }>(),
	},
	//#endregion
} as const;

export type IClientDirectory = Satisfies<typeof ClientDirectorySchema, SocketInterfaceDefinitionVerified<typeof ClientDirectorySchema>>;
export type IClientDirectoryArgument = SocketInterfaceRequest<IClientDirectory>;
export type IClientDirectoryResult = SocketInterfaceHandlerResult<IClientDirectory>;
export type IClientDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IClientDirectory>;
export type IClientDirectoryNormalResult = SocketInterfaceResponse<IClientDirectory>;
