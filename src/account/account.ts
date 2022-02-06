import type { IConnectionClient } from '../networking/common';

import AccountSecure, { GenerateAccountSecureData } from './accountSecure';

/** Currently logged in or recently used account */
export class Account {
	/** Time when this account was last used */
	public lastActivity: number;
	/** The account's saved data */
	public data: Omit<DatabaseAccount, 'secure'>;
	/** List of connections logged in as this account */
	public associatedConnections: Set<IConnectionClient> = new Set();

	public readonly secure: AccountSecure;

	constructor(data: DatabaseAccountWithSecure) {
		this.lastActivity = Date.now();
		this.secure = new AccountSecure(data, data.secure);
		// Shallow copy to preserve received data when cleaning up secure
		const cleanData: DatabaseAccount = { ...data };
		delete cleanData.secure;
		this.data = cleanData;
	}

	/** Update last activity timestamp to reflect last usage */
	public touch(): void {
		this.lastActivity = Date.now();
	}

	/** Checks if the account is activated */
	public isActivated(): boolean {
		return this.secure.isActivated();
	}
}

export async function CreateAccountData(username: string, password: string, email: string, activated: boolean = false): Promise<DatabaseAccountWithSecure> {
	return {
		username,
		id: -1, // generated by database
		created: Date.now(),
		secure: await GenerateAccountSecureData(password, email, activated),
	};
}
