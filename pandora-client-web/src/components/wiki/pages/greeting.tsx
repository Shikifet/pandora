import React, { ReactElement } from 'react';
import { Row } from '../../common/container/container';
import { WikiContent } from '../wiki';

export function WikiGreeting(): ReactElement {
	// TODO: This component is now unused, but the parts below were not in incorporated to the tutorials that replace this page.
	// They should be removed as that happens.
	return (
		<Row className='fill-y'>
			<WikiContent>
				<p>
					{ /* Include in "Items" tutorial */ }
					During your stay you will often encounter various restraining items.
					Restraints in Pandora are very secure and can really get you stuck with no one else being able to help so please be mindful of that.
					As always, communication with others is the most important tool in our club community, but Pandora also offers several mechanisms to keep you safe.<br />
					<br />
					{ /* Include in "Permissions" tutorial */ }
					First of those is the ability to enforce your own limits through <i>permissions</i> - allowing you to prevent others from doing certain things to your character.
					Right now, the club is a totally safe space. You have to permit other visitors to be able to do actions individually or
					generally, before anything can happen to you. Moreover, due to the security of restraints in Pandora, stricter ones such as
					password locks are set to be unavailable to other characters until you change these default item limits.<br />
					<br />
					{ /* Include in "Safeword" tutorial */ }
					Second important mechanism is for when communication should fail or someone is not respecting your safeword. For such a case there are two safe modes,
					which you can enter under the "Room"-tab via a button next to your character name: Timeout and safemode.
					Both modes prevent interactions in both ways while active. Do note, however, that we consider safemode a last-resort option for emergencies.
					It comes with a cooldown period that simulates stopping the play after a safeword usage to recover and be safe.<br />
					<br />
				</p>
			</WikiContent>
		</Row>
	);
}
