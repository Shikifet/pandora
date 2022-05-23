import { Application, Container, Graphics, InteractionManager, Rectangle, Sprite, Texture } from 'pixi.js';
import * as PixiViewport from 'pixi-viewport';
import { useRef, useEffect } from 'react';
import { TypedEventEmitter } from '../event';
import { CharacterSize } from 'pandora-common';

const GRAPHICS_HEIGHT = CharacterSize.HEIGHT;
const GRAPHICS_WIDTH = CharacterSize.WIDTH;

export class GraphicsScene extends TypedEventEmitter<{ resize: void; }> {
	private readonly _app: Application;
	private readonly _container: PixiViewport.Viewport;
	private element: HTMLElement | undefined;
	private readonly resizeObserver: ResizeObserver;

	get width(): number {
		return this._app.renderer.width;
	}

	get height(): number {
		return this._app.renderer.height;
	}

	constructor() {
		super();
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this._app = new Application({
			backgroundColor: 0x1099bb,
			resolution: window.devicePixelRatio || 1,
			antialias: true,
		});
		this._container = new PixiViewport.Viewport({
			worldHeight: GRAPHICS_HEIGHT,
			worldWidth: GRAPHICS_WIDTH,
			interaction: this._app.renderer.plugins.interaction as InteractionManager,
		});
		this._container
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.bounce({
				ease: 'easeOutQuad',
				friction: 0,
				sides: 'all',
				time: 500,
				underflow: 'center',
				bounceBox: new Rectangle(-20, -20, GRAPHICS_WIDTH + 20, GRAPHICS_HEIGHT + 20),
			})
			.pinch({ noDrag: false, percent: 2 })
			.decelerate({ friction: 0.7 });
		this._container.sortableChildren = true;
		const border = this._container.addChild(new Graphics());
		border.zIndex = 2;
		border.clear().lineStyle(2, 0x404040).drawRect(0, 0, GRAPHICS_WIDTH, GRAPHICS_HEIGHT);
		this._app.stage.addChild(this._container);
	}

	renderTo(element: HTMLElement): () => void {
		if (this.element !== undefined) {
			this.resizeObserver.unobserve(this.element);
			this._app.resizeTo = window;
			this.element.removeChild(this._app.view);
			this.element = undefined;
		}
		element.appendChild(this._app.view);
		this._app.resizeTo = element;
		this.resizeObserver.observe(element);
		this.resize();
		return () => {
			if (this.element === element) {
				this.resizeObserver.unobserve(element);
				this._app.resizeTo = window;
				element.removeChild(this._app.view);
				this.element = undefined;
			}
		};
	}

	resize(): void {
		this._app.resize();
		const width = this._app.screen.width;
		const height = this._app.screen.height;
		this._container.resize(width, height);
		this._container.clampZoom({
			minScale: Math.min(height / GRAPHICS_HEIGHT, width / GRAPHICS_WIDTH) * 0.9,
			maxScale: 2,
		});
		this._container.fit();
		this.emit('resize', undefined);
	}

	add<T extends Container>(container: T, zIndex: number = 0): T {
		const result = this._container.addChild(container);
		result.zIndex = zIndex;
		return result;
	}

	remove(container: Container): void {
		this._container.removeChild(container);
	}

	private _background = '';
	private _backgroundSprite?: Sprite;
	get background(): string {
		if (this._background) return this.background;
		const { backgroundColor } = this._app.renderer;
		return `#${backgroundColor.toString(16).padStart(6, '0')}`;
	}
	set background(data: string) {
		if (/#[0-9a-f]{6, 8}/i.test(data)) {
			this._background = '';
			this._backgroundSprite?.destroy();
			this._backgroundSprite = undefined;
			this._app.renderer.backgroundColor = parseInt(data.substring(1, 7), 16);
			if (data.length > 7) {
				this._app.renderer.backgroundAlpha = parseInt(data.substring(7, 9), 16) / 255;
			}
		} else if (/data:image\/png;base64,[0-9a-zA-Z+/=]+/i.test(data)) {
			this._background = data;
			const img = new Image();
			img.src = data;
			this._backgroundSprite = this.add(new Sprite(Texture.from(img)), -1000);
			this._backgroundSprite.width = this._app.renderer.width;
			this._backgroundSprite.height = this._app.renderer.height;
		} else if (/https?:\/\/.+/i.test(data)) {
			this._background = data;
			(async () => {
				this._backgroundSprite = this.add(new Sprite(await Texture.fromURL(data)), -1000);
				this._backgroundSprite.width = this._app.renderer.width;
				this._backgroundSprite.height = this._app.renderer.height;
			})().catch(() => { /** */ });
		} else {
			// eslint-disable-next-line no-console
			console.log('Invalid background data: ' + data);
		}
	}
}

export function useGraphicsScene<T extends HTMLElement>(scene: GraphicsScene): React.RefObject<T> {
	const ref = useRef<T>(null);
	useEffect(() => {
		if (ref.current) {
			return scene.renderTo(ref.current);
		}
		return undefined;
	}, [scene, ref]);
	return ref;
}
