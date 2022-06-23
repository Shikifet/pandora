import { AppearanceChangeType, BoneName, BoneState, GetLogger, AssetId, LayerPriority, ArmsPose, AssertNever } from 'pandora-common';
import { LayerState, PRIORITY_ORDER_ARMS_BACK, PRIORITY_ORDER_ARMS_FRONT, PRIORITY_ORDER_REVERSE_PRIORITIES } from './def';
import { AtomicCondition, CharacterSize, CharacterView, TransformDefinition } from 'pandora-common/dist/assets';
import { Container, IDestroyOptions } from 'pixi.js';
import { AppearanceContainer } from '../character/character';
import { GraphicsLayer } from './graphicsLayer';
import { EvaluateCondition, RotateVector } from './utility';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';

const logger = GetLogger('GraphicsCharacter');

export type GraphicsGetterFunction = (asset: AssetId) => AssetGraphics | undefined;

export const FAKE_BONES: string[] = ['backView'];

export class GraphicsCharacter<ContainerType extends AppearanceContainer = AppearanceContainer> extends Container {
	protected graphicsGetter: GraphicsGetterFunction | undefined;
	readonly appearanceContainer: ContainerType;
	private _layers: LayerState[] = [];
	private _pose: Record<BoneName, number> = {};
	private _cleanupUpdate?: () => void;

	constructor(appearanceContainer: ContainerType) {
		super();

		this.pivot.x = CharacterSize.WIDTH / 2;
		this.position.x = this.pivot.x;

		this.sortableChildren = true;

		this.appearanceContainer = appearanceContainer;

		this._cleanupUpdate = this.appearanceContainer.on('appearanceUpdate', (changes) => this.update(changes));
	}

	override destroy(options?: boolean | IDestroyOptions): void {
		this._cleanupUpdate?.();
		this._cleanupUpdate = undefined;
		super.destroy(options);
	}

	public useGraphics(graphicsGetter: GraphicsGetterFunction): void {
		this.graphicsGetter = graphicsGetter;
		this.update(['items', 'pose']);
	}

	protected update(changes: AppearanceChangeType[]): void {
		if (changes.length === 0)
			return;
		if (changes.includes('items')) {
			this._layers = this.buildLayers();
		}
		const updatedBones = new Set<string>();
		if (changes.includes('pose')) {
			const newPose = this.appearanceContainer.appearance.getFullPose();
			for (const bone of newPose) {
				if (this._pose[bone.definition.name] !== bone.rotation) {
					updatedBones.add(bone.definition.name);
					this._pose[bone.definition.name] = bone.rotation;
				}
			}
			// Fake bones have more logic, so they can change anytime
			FAKE_BONES.forEach((b) => updatedBones.add(b));
		}
		this.layerUpdate(updatedBones);
	}

	protected buildLayers(): LayerState[] {
		if (!this.graphicsGetter)
			return [];
		const result: LayerState[] = [];
		for (const item of this.appearanceContainer.appearance.getAllItems()) {
			const graphics = this.graphicsGetter(item.asset.id);
			if (!graphics) {
				if (item.asset.definition.hasGraphics) {
					logger.warning(`Asset ${item.asset.id} hasGraphics, but no graphics found`);
				}
				continue;
			}
			result.push(
				...graphics.allLayers.map((layer) => ({
					layer,
				})),
			);
		}
		return result;
	}

	public getSortOrder(): readonly LayerPriority[] {
		const armsPose = this.appearanceContainer.appearance.getArmsPose();
		if (armsPose === ArmsPose.FRONT) {
			return PRIORITY_ORDER_ARMS_FRONT;
		} else if (armsPose === ArmsPose.BACK) {
			return PRIORITY_ORDER_ARMS_BACK;
		}
		AssertNever(armsPose);
	}

	protected sortLayers(toSort: LayerState[]): LayerState[] {
		const sortOrder = this.getSortOrder();
		const result: LayerState[] = [];
		for (const priority of sortOrder) {
			const temp = toSort.filter((l) => l.layer.definition.priority === priority);
			if (PRIORITY_ORDER_REVERSE_PRIORITIES.has(priority)) {
				temp.reverse();
			}
			result.push(...temp);
		}
		const view = this.appearanceContainer.appearance.getView();
		if (view === CharacterView.BACK) {
			result.reverse();
		}
		return result.concat(toSort.filter((l) => !result.includes(l)));
	}

	protected createLayer(layer: AssetGraphicsLayer): GraphicsLayer {
		return new GraphicsLayer(layer, this);
	}

	private _graphicsLayers = new Map<LayerState, GraphicsLayer>();
	protected layerUpdate(bones: Set<string>): void {
		this._evalCache.clear();
		for (const [key, graphics] of this._graphicsLayers) {
			if (!this._layers.includes(key)) {
				this._graphicsLayers.delete(key);
				this.removeChild(graphics);
				graphics.destroy();
			}
		}
		this.sortLayers(this._layers.slice()).forEach((layerState, index) => {
			let graphics = this._graphicsLayers.get(layerState);
			if (!graphics) {
				graphics = this.createLayer(layerState.layer);
				this._graphicsLayers.set(layerState, graphics);
				this.addChild(graphics);
				graphics.update({ state: layerState.state, force: true });
			} else {
				graphics.update({ state: layerState.state, bones });
			}
			graphics.zIndex = index;
		});
		this.sortChildren();
		const backView = this.appearanceContainer.appearance.getView() === CharacterView.BACK;
		this.scale.x = backView ? -1 : 1;
	}

	//#region Point transform
	private readonly _evalCache = new Map<string, boolean>();
	public evalCondition(condition: AtomicCondition): boolean {
		const key = `${condition.bone}-${condition.operator}-${condition.value}`;
		let result = this._evalCache.get(key);
		if (result === undefined) {
			const value = this.getBoneLikeValue(condition.bone);
			this._evalCache.set(key, result = this._evalConditionCore(condition, value));
		}
		return result;
	}
	private _evalConditionCore({ operator, value }: AtomicCondition, currentValue: number): boolean {
		switch (operator) {
			case '>':
				return currentValue > value;
			case '<':
				return currentValue < value;
			case '=':
				return currentValue === value;
			case '!=':
				return currentValue !== value;
			case '>=':
				return currentValue >= value;
			case '<=':
				return currentValue <= value;
		}
		AssertNever(operator);
	}

	public evalTransform([x, y]: [number, number], transforms: readonly TransformDefinition[], _mirror: boolean): [number, number] {
		let [resX, resY] = [x, y];
		for (const transform of transforms) {
			const { type, bone: boneName, condition } = transform;
			const bone = this.getBone(boneName);
			if (condition && !EvaluateCondition(condition, (c) => this.evalCondition(c))) {
				continue;
			}
			switch (type) {
				case 'rotate': {
					let vecX = resX - bone.definition.x;
					let vecY = resY - bone.definition.y;
					const value = transform.value * bone.rotation;
					[vecX, vecY] = RotateVector(vecX, vecY, value);
					resX = bone.definition.x + vecX;
					resY = bone.definition.y + vecY;
					break;
				}
				case 'shift': {
					const percent = bone.rotation / 180;
					resX += percent * transform.value.x;
					resY += percent * transform.value.y;
					break;
				}
			}
		}
		return [resX, resY];
	}
	//#endregion

	public getBone(name: string): BoneState {
		return this.appearanceContainer.appearance.getPose(name);
	}

	public getBoneLikeValue(name: string): number {
		if (name === 'backView') {
			return this.appearanceContainer.appearance.getView() === CharacterView.BACK ? 1 : 0;
		}
		return this.getBone(name).rotation;
	}
}
