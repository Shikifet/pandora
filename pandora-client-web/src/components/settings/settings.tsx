import { ReactElement } from 'react';
import { BUILD_TIME, GIT_DESCRIBE } from '../../config/Environment.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs.tsx';
import { AccountSettings } from './accountSettings.tsx';
import { CharacterSettings } from './characterSettings.tsx';
import { GraphicsSettings } from './graphicsSettings.tsx';
import { InterfaceSettings } from './interfaceSettings.tsx';
import { NotificationSettings } from './notificationSettings.tsx';
import { PermissionsSettings } from './permissionsSettings.tsx';
import { SecuritySettings } from './securitySettings.tsx';
import './settings.scss';

export function Settings(): ReactElement | null {
	const navigate = useNavigatePandora();

	return (
		<>
			<div className='settings'>
				<UrlTabContainer className='flex-1' allowWrap>
					<UrlTab name='Permissions' urlChunk='permissions'>
						<SettingsTab element={ PermissionsSettings } />
					</UrlTab>
					<UrlTab name='Character' urlChunk='character'>
						<SettingsTab element={ CharacterSettings } />
					</UrlTab>
					<UrlTab name='Account' urlChunk='account'>
						<SettingsTab element={ AccountSettings } />
					</UrlTab>
					<UrlTab name='Notifications' urlChunk='notifications'>
						<SettingsTab element={ NotificationSettings } />
					</UrlTab>
					<UrlTab name='Security' urlChunk='security'>
						<SettingsTab element={ SecuritySettings } />
					</UrlTab>
					<UrlTab name='Interface' urlChunk='interface'>
						<SettingsTab element={ InterfaceSettings } />
					</UrlTab>
					<UrlTab name='Graphics' urlChunk='graphics'>
						<SettingsTab element={ GraphicsSettings } />
					</UrlTab>
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
				</UrlTabContainer>
			</div>
			<footer>Version: { GIT_DESCRIBE } from { new Date(BUILD_TIME).toLocaleDateString() }</footer>
		</>
	);
}

function SettingsTab({ element: Element }: { element: () => ReactElement | null; }): ReactElement {
	return (
		<div className='settings-tab-wrapper'>
			<div className='settings-tab'>
				<div className='settings-tab-contents'>
					<Element />
				</div>
			</div>
		</div>
	);
}
