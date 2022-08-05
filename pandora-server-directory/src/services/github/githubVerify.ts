import { GetLogger } from 'pandora-common';
import { accountManager } from '../../account/accountManager';

import { Octokit } from '@octokit/rest';
import { createOAuthUserAuth, createOAuthAppAuth } from '@octokit/auth-oauth-app';
import { nanoid } from 'nanoid';
import { URL } from 'url';
import { Request, Response, Router } from 'express';

const API_PATH = 'https://github.com/login/oauth/';

/** GitHub invalidated state after 10 minuets, extra minute is added as the timeout only starts when the client request it */
const GITHUB_OAUTH_STATE_TIMEOUT = 1000 * 60 * (10 + 1);
/** GitHub OAuth client id */
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
/** GitHub OAuth client secret */
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
/** GitHub personal access token */
const GITHUB_PERSONAL_ACCESS_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '';
const GITHUB_ORG_NAME = 'Project-Pandora-Game';

const logger = GetLogger('GitHubVerifier');

const states = new Map<string, { accountId: number, login: string; }>();

let octokitOrg!: Octokit;
let octokitApp!: Octokit;

export const GitHubVerifier = new class GitHubVerifier {
	private _active = false;

	public get active(): boolean {
		return this._active;
	}

	public async init(): Promise<this> {
		if (this.active) {
			return this;
		}
		if (!GITHUB_PERSONAL_ACCESS_TOKEN || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
			logger.warning('Secret is not set, GitHub OAuth is disabled');
			return this;
		}
		// TODO remove this once the org is public
		octokitOrg = new Octokit({
			auth: `token ${GITHUB_PERSONAL_ACCESS_TOKEN}`,
		});
		if (!await GitHubCheckSecret(octokitOrg, true)) {
			logger.warning('Personal access token is invalid, GitHub OAuth is disabled');
			return this;
		}
		octokitApp = new Octokit({
			authStrategy: createOAuthAppAuth,
			auth: {
				clientId: GITHUB_CLIENT_ID,
				clientSecret: GITHUB_CLIENT_SECRET,
			},
		});
		if (!await GitHubCheckSecret(octokitApp)) {
			logger.warning('Client secret is invalid, GitHub OAuth is disabled');
			return this;
		}

		this._active = true;

		logger.info('GitHub Verifier API is attached');
		return this;
	}

	public async getGitHubRole({ id, login }: Pick<GitHubInfo, 'id' | 'login'>): Promise<GitHubInfo['role']> {
		const org = await octokitOrg.orgs.getMembershipForUser({ org: GITHUB_ORG_NAME, username: login });
		if (org.status === 200 && org.data.state === 'active' && org.data.user?.id === id) {
			return org.data.role === 'admin' ? 'admin' : 'member';
		}
		const outside = await octokitOrg.orgs.listOutsideCollaborators({ org: GITHUB_ORG_NAME });
		if (outside.status === 200 && outside.data.some((user) => user.id === id && user.login === login)) {
			return 'collaborator';
		}
		return 'none';
	}

	public prepareLink(accountId: number, login: string): string | null {
		if (!this.active) {
			return null;
		}

		const state = `${accountId}-${nanoid()}`;
		states.set(state, { accountId, login });
		setTimeout(() => states.delete(state), GITHUB_OAUTH_STATE_TIMEOUT);

		const api = new URL(API_PATH + 'authorize');
		api.searchParams.set('client_id', GITHUB_CLIENT_ID);
		api.searchParams.set('login', login);
		api.searchParams.set('state', state);
		api.searchParams.set('allow_signup', 'false');

		return api.toString();
	}
};

async function GitHubCheckSecret(octokit: Octokit, canRead: boolean = false): Promise<boolean> {
	try {
		const { status, data } = await octokit.orgs.listMembers({ org: GITHUB_ORG_NAME });
		if (status !== 200)
			return false;

		return canRead ? data.length > 0 : true;
	} catch {
		return false;
	}
}

export function GitHubVerifierAPI(): Router {
	const router = Router();
	router.use('callback', (req, res) => {
		if (!GitHubVerifier.active) {
			res.status(404).send('GitHub Verifier API is not attached').end();
			return;
		}
		HandleCallback(req, res).catch((err) => res.status(500).end(err));
	});
	return router;
}

async function HandleCallback(req: Request, res: Response): Promise<void> {
	const { code, state } = req.query;
	if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
		res.status(400).send('Bad Request').end();
		return;
	}

	const { accountId, login: requestedLogin } = states.get(state) || {};
	if (!accountId || !requestedLogin) {
		res.status(400).send('Bad Request').end();
		return;
	}

	states.delete(state);

	try {
		const octokit = new Octokit({
			authStrategy: createOAuthUserAuth,
			auth: {
				clientId: GITHUB_CLIENT_ID,
				clientSecret: GITHUB_CLIENT_SECRET,
				code,
				state,
			},
		});

		const { status, data } = await octokit.users.getAuthenticated();
		if (status !== 200 || !data || !data.id || data.type !== 'User' || data.login.localeCompare(requestedLogin, undefined, { sensitivity: 'base' }) !== 0) {
			res.status(403).send('Forbidden').end();
			return;
		}

		await UpdateGitHubRole(data, accountId);

		res.set('Content-Type', 'text/html')
			.status(200)
			.send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Success</title></head><body><h1>Success</h1><p>You can close this window now.</p></body></html>')
			.end();
	} catch {
		res.status(403).send('Forbidden').end();
	}
}

async function UpdateGitHubRole({ login, id }: Awaited<ReturnType<Octokit['users']['getByUsername']>>['data'], accountId: number): Promise<void> {
	try {
		const role = await GitHubVerifier.getGitHubRole({ id: id as number, login: login as string });
		const account = await accountManager.loadAccountById(accountId);
		if (!account) {
			logger.warning(`Account ${accountId} not found`);
			return;
		}
		await account.secure.setGitHubInfo({
			login: login as string,
			id: id as number,
			role,
		});
	} catch (e) {
		logger.error('Failed to get GitHub role', e);
	}
}
