import TransportU2F from '@ledgerhq/hw-transport-u2f';
import TransportWebBLE from '@ledgerhq/hw-transport-web-ble';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import { Api, ApiInterfaces, RpcInterfaces, Key, Numeric } from '@proton/js';
import LedgerDataManager from './manager';
import { EosLedgerApi } from './api';

export interface matchedIndexItem {
	index: number;
	key: string;
}

export interface WalletAuth {
	accountName: string;
	permission: string;
	publicKey: string;
}

async function promiseTimeout (ms: number, promise: Promise<any>) {
	return new Promise(async (resolve, reject) => {
		let timer = setTimeout(() => reject(new Error('Promise Timed Out')), ms)
		try {
			const result = await promise
			clearTimeout(timer)
			resolve(result)
		} catch (e) {
			clearTimeout(timer)
			reject(e)
		}
	})
}

class LedgerProxy {
	transport: any;
	api: any;
	public constructor(transport: any){
		this.transport = transport;
		this.api = new EosLedgerApi(this.transport)
	};

	async getPathKeys(keyPositions: number[]): Promise<matchedIndexItem[]> {
		let keys: matchedIndexItem[] = [];

		for (const index of keyPositions) {
			const { address: key } = await this.api.getAddress("44'/194'/0'/0/" + index);
			keys.push({ index, key });
		}

		return keys;
	}

	async sign(toSign: Buffer, index: number): Promise<string> {
		const toSignHex = toSign.toString('hex');
		const signature = await this.api.signTransaction(`44'/194'/0'/0/${index}`, toSignHex);
		const ec = Key.constructElliptic(Numeric.KeyType.k1)
		const ellipticSignature = new Key.Signature({ type: Numeric.KeyType.k1, data: signature }, ec)
		return Key.Signature.fromElliptic(ellipticSignature.toElliptic(), Numeric.KeyType.k1).toString();
	}

	async getAppConfiguration() {
		return await this.api.getAppConfiguration()
	}
}

export type TransportType = 'TransportWebAuthn' | 'TransportU2F' | 'TransportWebBLE' | 'TransportWebusb' | 'TransportWebHID';

export function ledgerWalletProvider(transport: TransportType = 'TransportU2F', api: Api) {
	let selectedIndex: number | undefined = undefined;
	let keyMap: matchedIndexItem[] = [];
	let ledger: LedgerProxy;
	let selectedTransport: any;

	async function connect() {
		switch (transport) {
			// case 'TransportWebAuthn': { selectedTransport = await TransportWebAuthn.create(); break; }
			case 'TransportWebBLE':   { selectedTransport = await TransportWebBLE.create(); break; }
			// case 'TransportWebusb':   { selectedTransport = await TransportWebusb.create(); break; }
			case 'TransportWebHID':   { selectedTransport = await TransportWebHID.create(); break; }
			default               :   { selectedTransport = await TransportU2F.create(); break; }
		}

		ledger = new LedgerProxy(selectedTransport);

		return await getAppConfiguration()
	}

	async function discover(pathIndexList: number[] = [ 0, 1, 2, 3 ]) {
		const missingIndexs: number[] = [];

		for (const index of pathIndexList) {
			let matchedIndex: matchedIndexItem | undefined = keyMap.find((i) => i.index === index);
			if (!matchedIndex) {
				missingIndexs.push(index);
			}
		}

		const keysResult: matchedIndexItem[] = await ledger.getPathKeys(missingIndexs)

		//Merge the new key info with any previous lookups
		return keyMap.concat(...keysResult);
	}

	// Authentication
	async function login(
		accountName?: string,
		authorization?: string,
		index?: number,
		key?: string
	): Promise<WalletAuth> {
		// Every time someone calls login we add to the list of account names + ledger index.
		// Then when it comes time to sign, we'll look for the accountName + auth match and use that Index to sign the txn.
		if (accountName && authorization && key && index != undefined) {
			selectedIndex = index
			keyMap.push({ key, index })
		} else {
			throw 'When calling the ledger login function: accountName, authorization, index and key must be supplied';
		}
		return {
			accountName: accountName,
			permission: authorization,
			publicKey: key
		};;
	}

	function signArbitrary(_: string, __: string): Promise<string> {
		throw Error('Not implemented!')
	}

	const signatureProvider = {
		async getAvailableKeys() {
			return keyMap.map((a) => a.key);
		},

		async sign(signatureProviderArgs: ApiInterfaces.SignatureProviderArgs): Promise<RpcInterfaces.PushTransactionArgs> {
			const tx = await api.deserializeTransaction(signatureProviderArgs.serializedTransaction);

			var ledgerManager = new LedgerDataManager();
			const ledgerBuffer = await ledgerManager.serialize(signatureProviderArgs.chainId, tx, api.abiTypes, api);

			console.log('selectedIndex: ' + selectedIndex);

			if (selectedIndex === undefined) throw new Error('Account not logged in')

			const signature = await ledger.sign(ledgerBuffer, selectedIndex);
			const signatureArray = [ signature ];
			return {
				signatures: signatureArray,
				serializedTransaction: signatureProviderArgs.serializedTransaction
			};
		}
	}

	async function getAppConfiguration(): Promise<any> {
		return promiseTimeout(3000, ledger.getAppConfiguration())
	}

	const walletProvider = {
		signatureProvider,
		connect,
		discover,
		login,
		signArbitrary,
		getAppConfiguration
	};

	return walletProvider;
}
