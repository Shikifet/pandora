import {
	TypedEventEmitter,
	CharacterAppearance,
	GetLogger,
	ICharacterPublicData,
	Item,
	Logger,
	CharacterRestrictionsManager,
	ActionRoomContext,
	ItemPath,
	CharacterId,
	AppearanceItems,
	WearableAssetType,
	AssetFrameworkCharacterState,
	Assert,
	ITypedEventEmitter,
	ICharacterRoomData,
	GameLogicCharacterClient,
	GameLogicCharacter,
} from 'pandora-common';
import { useMemo, useSyncExternalStore } from 'react';
import type { PlayerCharacter } from './player';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';
import { noop } from 'lodash';

export interface ICharacter<T extends ICharacterPublicData = ICharacterPublicData> extends ITypedEventEmitter<CharacterEvents<T>> {
	readonly type: 'character';
	readonly id: CharacterId;
	readonly name: string;
	readonly data: Readonly<T>;
	readonly gameLogicCharacter: GameLogicCharacter;
	isPlayer(): boolean;
	getAppearance(state: AssetFrameworkCharacterState): CharacterAppearance;
	getRestrictionManager(state: AssetFrameworkCharacterState, roomContext: ActionRoomContext | null): CharacterRestrictionsManager;
}

export type IChatroomCharacter = ICharacter<ICharacterRoomData>;

export class Character<T extends ICharacterPublicData = ICharacterPublicData> extends TypedEventEmitter<CharacterEvents<T>> implements ICharacter<T> {
	public readonly type = 'character';

	public get id(): CharacterId {
		return this.data.id;
	}

	public get name(): string {
		return this.data.name;
	}

	protected readonly logger: Logger;

	protected _data: T;
	public get data(): Readonly<T> {
		return this._data;
	}

	public readonly gameLogicCharacter: GameLogicCharacterClient;

	constructor(data: T, logger?: Logger) {
		super();
		this.logger = logger ?? GetLogger('Character', `[Character ${data.id}]`);
		this._data = data;

		this.gameLogicCharacter = new GameLogicCharacterClient(() => this._data, this.logger.prefixMessages('[GameLogic]'));

		this.logger.verbose('Loaded');
	}

	public isPlayer(): this is PlayerCharacter {
		return false;
	}

	public update(data: Partial<T>): void {
		this._data = { ...this.data, ...data };
		this.logger.debug('Updated', data);
		this.emit('update', data);
	}

	public getAppearance(state: AssetFrameworkCharacterState): CharacterAppearance {
		Assert(state.id === this.id);
		return new CharacterAppearance(state, this.gameLogicCharacter);
	}

	public getRestrictionManager(state: AssetFrameworkCharacterState, roomContext: ActionRoomContext): CharacterRestrictionsManager {
		return this.getAppearance(state).getRestrictionManager(roomContext);
	}
}

export type CharacterEvents<T extends ICharacterPublicData> = {
	'update': Partial<T>;
};

export function useCharacterData<T extends ICharacterPublicData>(character: ICharacter<T>): Readonly<T> {
	return useSyncExternalStore(character.getSubscriber('update'), () => character.data);
}

export function useCharacterDataOptional<T extends ICharacterPublicData>(character: ICharacter<T> | null): Readonly<T> | null {
	const subscriber = useMemo(() => (character?.getSubscriber('update') ?? (() => noop)), [character]);

	return useSyncExternalStore(subscriber, () => (character?.data ?? null));
}

export function useCharacterAppearance(characterState: AssetFrameworkCharacterState, character: Character): CharacterAppearance {
	return useMemo(() => character.getAppearance(characterState), [characterState, character]);
}

export function useCharacterAppearanceItems(characterState: AssetFrameworkCharacterState): AppearanceItems<WearableAssetType> {
	return characterState.items;
}

export function useCharacterAppearanceItem(characterState: AssetFrameworkCharacterState, path: ItemPath | null | undefined): Item | undefined {
	const items = useCharacterAppearanceItems(characterState);

	return useMemo(() => (items && path) ? EvalItemPath(items, path) : undefined, [items, path]);
}
