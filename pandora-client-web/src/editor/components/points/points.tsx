import React, { ReactElement, useCallback, useState, useSyncExternalStore } from 'react';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { GetAssetManager } from '../../../assets/assetManager';
import { GraphicsManagerInstance } from '../../../assets/graphicsManager';
import { useSyncUserInput } from '../../../common/useSyncUserInput';
import { Button } from '../../../components/common/Button/Button';
import { Select } from '../../../components/common/Select/Select';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { useObservable } from '../../../observable';
import { useEditorAssetLayers } from '../../editor';
import { useEditor } from '../../editorContextProvider';
import { EditorAssetGraphics } from '../../graphics/character/appearanceEditor';
import { DraggablePoint } from '../../graphics/draggable';
import { ParseTransforms, SerializeTransforms } from '../../parsing';

export function PointsUI(): ReactElement {
	const editor = useEditor();
	const selectedLayer = useObservable(editor.targetLayer);
	const asset = selectedLayer?.asset;

	const advancedWarning = <h3 className='error'>This menu is intended for advanced users and is not necessary for the vast majority of assets.</h3>;

	if (!selectedLayer || !asset || !(asset instanceof EditorAssetGraphics)) {
		return (
			<div className='editor-setupui'>
				{ advancedWarning }
				<h3>Select an layer to edit its points</h3>
			</div>
		);
	}

	return (
		<Scrollbar color='lighter' className='editor-setupui slim'>
			{ advancedWarning }
			<h3>Editing: { StripAssetIdPrefix(selectedLayer.asset.id) } &gt; {selectedLayer.name}</h3>
			<MirrorPointsFromLayer layer={ selectedLayer } asset={ asset } />
			<PointsEditUi layer={ selectedLayer } />
		</Scrollbar>
	);
}

export function PointsEditUi({ layer }: { layer: AssetGraphicsLayer; }): ReactElement {
	const editor = useEditor();
	const getCenter = useObservable(editor.getCenter);
	const selectedPoint = useObservable(editor.targetPoint);
	const points = useSyncExternalStore(layer.getSubscriber('change'), () => layer.definition.points);

	if (typeof points === 'string') {
		return <div>Template cannot be edited</div>;
	}

	return (
		<>
			<Button onClick={ () => {
				const pos = getCenter();
				layer.createNewPoint(pos.x, pos.y);
			} }>
				Add new point
			</Button>
			<h4>POINT CONFIGURATION</h4>
			{
				selectedPoint ?
					<PointConfiguration point={ selectedPoint } /> :
					<div>No point selected</div>
			}
		</>
	);
}

function MirrorPointsFromLayer({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const layers = useEditorAssetLayers(asset, false);
	const points = useSyncExternalStore(layer.getSubscriber('change'), () => layer.definition.points);
	const graphicsManger = useObservable(GraphicsManagerInstance);

	if (!graphicsManger)
		return null;

	const elements: ReactElement[] = [<option value='' key=''>[ None ]</option>];
	for (const l of layers) {
		if (Array.isArray(l.definition.points) && l !== layer) {
			elements.push(
				<option value={ l.index } key={ l.index }>{ l.name }</option>,
			);
		}
	}
	// Add point template options
	for (const t of graphicsManger.pointTemplateList) {
		const id = `t/${t}`;
		elements.push(
			<option value={ id } key={ id }>Template: { t }</option>,
		);
	}
	return (
		<>
			<div>
				<label htmlFor='mirror-points-from-layer'>Mirror all points from selected layer:</label>
				<br />
				<Select
					id='mirror-points-from-layer'
					value={ typeof points === 'number' ? `${points}` : typeof points === 'string' ? `t/${points}` : '' }
					onChange={ (event) => {
						let source: number | string | null = null;
						if (event.target.value.startsWith('t/')) {
							source = event.target.value.substring(2);
						} else if (event.target.value) {
							source = Number.parseInt(event.target.value);
						}
						asset.layerMirrorFrom(layer, source);
					} }
				>
					{ elements }
				</Select>
			</div>
			{
				typeof points === 'number' &&
				<>
					<div>Points are mirrored from layer: { asset.layers[points].name }</div>
					<Button onClick={ () => {
						asset.layerMirrorFrom(layer, null);
					} }>
						Unlink mirrored points
					</Button>
				</>
			}
			{
				typeof points === 'string' &&
				<>
					<div>Points are from template: { points }</div>
					<Button onClick={ () => {
						asset.layerMirrorFrom(layer, null);
					} }>
						Unlink point template
					</Button>
				</>
			}
		</>
	);
}

function PointConfiguration({ point }: { point: DraggablePoint; }): ReactElement | null {
	const pointX = useSyncExternalStore(point.getSubscriber('change'), () => point.x);
	const pointY = useSyncExternalStore(point.getSubscriber('change'), () => point.y);
	const pointMirror = useSyncExternalStore(point.getSubscriber('change'), () => point.mirror);
	const pointType = useSyncExternalStore(point.getSubscriber('change'), () => point.pointType);

	return (
		<>
			<div>
				<label htmlFor='x-coord'>X:</label>
				<input
					id='x-coord'
					type='number'
					value={ pointX }
					onChange={ (e) => {
						point.setPos(Number.parseInt(e.target.value) || 0, pointY);
					} }
				/>
			</div>
			<div>
				<label htmlFor='y-coord'>Y:</label>
				<input
					id='y-coord'
					type='number'
					value={ pointY }
					onChange={ (e) => {
						point.setPos(pointX, Number.parseInt(e.target.value) || 0);
					} }
				/>
			</div>
			<div>List of transformations for this point:</div>
			<PointTransformationsTextarea point={ point } />
			<div>
				<label>Mirror point to the opposing character half</label>
				<input
					type='checkbox'
					checked={ pointMirror }
					onChange={ (e) => {
						point.setMirror(e.target.checked);
					} }
				/>
			</div>
			<div>
				<label htmlFor='point-type'>Point type:</label>
				<input
					id='point-type'
					spellCheck='false'
					value={ pointType ?? '' }
					onChange={ (e) => point.setPointType(e.target.value || undefined) }
				/>
			</div>
			<Button
				onClick={ () => {
					point.deletePoint();
				} }>
				Delete this point
			</Button>
		</>
	);
}

function PointTransformationsTextarea({ point }: { point: DraggablePoint; }): ReactElement | null {
	const [value, setValue] = useSyncUserInput(point.getSubscriber('change'), () => SerializeTransforms(point.transforms), [point]);
	const [error, setError] = useState<string | null>(null);

	const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		try {
			const result = ParseTransforms(e.target.value, GetAssetManager().getAllBones().map((b) => b.name));
			setError(null);
			point.setTransforms(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [point, setValue]);

	return (
		<>
			<textarea
				spellCheck='false'
				rows={ 6 }
				value={ value }
				onChange={ onChange }
			/>
			{ error != null && <div className='error'>{ error }</div> }
		</>
	);
}
