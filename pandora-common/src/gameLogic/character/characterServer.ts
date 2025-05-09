import type { AssetManager } from '../../assets/assetManager.ts';
import type { ICharacterDataShard } from '../../character/index.ts';
import type { Logger } from '../../logging/logger.ts';
import { AssertNever } from '../../utility/misc.ts';
import { AssetPreferencesSubsystemServer } from '../assetPreferences/index.ts';
import { MakeDefaultCharacterModifierSystemData } from '../characterModifiers/characterModifierData.ts';
import { CharacterModifiersSubsystemServer } from '../characterModifiers/characterModifiersSubsystemServer.ts';
import { MakeDefaultInteractionSystemData } from '../interactions/interactionData.ts';
import { InteractionSubsystemServer } from '../interactions/interactionSubsystemServer.ts';
import { GameLogicPermissionServer, IPermissionProvider, PermissionGroup } from '../permissions/index.ts';
import { GameLogicCharacter } from './character.ts';

export class GameLogicCharacterServer extends GameLogicCharacter {
	public override readonly interactions: InteractionSubsystemServer;
	public override readonly assetPreferences: AssetPreferencesSubsystemServer;
	public override readonly characterModifiers: CharacterModifiersSubsystemServer;

	constructor(data: ICharacterDataShard, assetManager: AssetManager, logger: Logger) {
		super(data);
		this.interactions = new InteractionSubsystemServer(
			this,
			data.interactionConfig ?? MakeDefaultInteractionSystemData(),
			logger.prefixMessages('[InteractionSubsystem]'),
		);
		this.assetPreferences = new AssetPreferencesSubsystemServer(
			this,
			data.assetPreferences,
			assetManager,
		);
		this.characterModifiers = new CharacterModifiersSubsystemServer(
			this,
			data.characterModifiers ?? MakeDefaultCharacterModifierSystemData(),
			assetManager,
			logger.prefixMessages('[CharacterModifiersSubsystem]'),
		);

		this.interactions.on('dataChanged', () => {
			this.emit('dataChanged', 'interactions');
		});
		this.assetPreferences.on('dataChanged', () => {
			this.emit('dataChanged', 'assetPreferences');
		});
		this.characterModifiers.on('dataChanged', () => {
			this.emit('dataChanged', 'characterModifiers');
		});
	}

	public reloadAssetManager(manager: AssetManager) {
		this.assetPreferences.reloadAssetManager(manager);
		this.characterModifiers.reloadAssetManager(manager);
	}

	protected override _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider<GameLogicPermissionServer> {
		switch (permissionGroup) {
			case 'assetPreferences':
				return this.assetPreferences;
			case 'interaction':
				return this.interactions;
			case 'characterModifierType':
				return this.characterModifiers;
			default:
				AssertNever(permissionGroup);
		}
	}

	public override getPermission(permissionGroup: PermissionGroup, permissionId: string): GameLogicPermissionServer | null {
		return this._getPermissionProvider(permissionGroup)
			.getPermission(permissionId);
	}
}
