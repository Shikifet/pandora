import React from 'react';
import { GAME_NAME, GAME_VERSION } from '../../config/Environment';

/**
 * Display the end user license agreement, with the option to accept it.
 */
export default function Eula({ accept }: EulaProps): React.ReactElement {
	return (
		<div className='eula'>
			<h1>Welcome to { GAME_NAME }</h1>
			<span>Game version: { GAME_VERSION }</span>
			<div className='eula-text'>
				<p>
					This game is intended for use by adults only.
				</p>
				<p>
					By playing this game, you agree to the following:
				</p>
				<ul>
					<li>
						You are at least 18 years old and I have the legal right to possess adult material in my local community, state and/or country.
					</li>
					<li>
						I will not permit any minors to have access to any of the materials from this site.
					</li>
					<li>
						I have carefully read the above and agree to all of them.
					</li>
				</ul>
			</div>
			<div className='eula-buttons'>
				<button onClick={ accept }>Accept</button>
				<button onClick={ EulaDisagree }>Disagree</button>
			</div>
		</div>
	);
}

type EulaProps = {
	accept: () => void;
};

function EulaDisagree() {
	window.location.href = 'https://google.com/';
}
