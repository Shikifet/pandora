import { Asset, AssetManager, AssetsDefinitionFile, AssetsGraphicsDefinitionFile, GetLogger } from 'pandora-common';
import { GraphicsManagerInstance, GraphicsManager } from './graphicsManager';
import { URLGraphicsLoader } from './graphicsLoader';
import { Observable, useObservable } from '../observable';
import { Immutable } from 'immer';
import { ConfigServerIndex } from '../config/searchArgs';

const logger = GetLogger('AssetManager');

export class AssetManagerClient extends AssetManager {
	public readonly assetList: readonly Asset[];

	constructor(definitionsHash?: string, data?: Immutable<AssetsDefinitionFile>) {
		super(definitionsHash, data);

		this.assetList = this.getAllAssets();
	}
}

const assetManager = new Observable<AssetManagerClient>(new AssetManagerClient());

export function GetCurrentAssetManager(): AssetManagerClient {
	return assetManager.value;
}

export function useAssetManager(): AssetManagerClient {
	return useObservable(assetManager);
}

export function UpdateAssetManager(manager: AssetManagerClient) {
	assetManager.value = manager;
}

let lastGraphicsHash: string | undefined;
let loader: URLGraphicsLoader | undefined;
let assetsSource: string = '';

export function GetAssetsSourceUrl(): string {
	return assetsSource;
}

export function LoadAssetDefinitions(definitionsHash: string, data: Immutable<AssetsDefinitionFile>, source: string): void {
	const manager = new AssetManagerClient(definitionsHash, data);
	UpdateAssetManager(manager);
	logger.info(`Loaded asset definitions, version: ${manager.definitionsHash}`);

	if (lastGraphicsHash === data.graphicsId)
		return;

	lastGraphicsHash = data.graphicsId;
	const lastAssetsSource = assetsSource;
	const assetsSourceOptions = source.split(';').map((a) => a.trim());
	assetsSource = assetsSourceOptions[ConfigServerIndex.value % assetsSourceOptions.length];

	if (lastAssetsSource !== assetsSource || loader == null) {
		loader = new URLGraphicsLoader(assetsSource);
	}
	const currentLoader = loader;
	currentLoader.loadTextFile(`graphics_${lastGraphicsHash}.json`).then((json) => {
		const graphics = JSON.parse(json) as AssetsGraphicsDefinitionFile;
		GraphicsManagerInstance.value = new GraphicsManager(currentLoader, data.graphicsId, graphics);
		logger.info(`Loaded graphics, version: ${data.graphicsId}`);
	}).catch((err) => {
		logger.error('Failed to load graphics', err);
	});
}
