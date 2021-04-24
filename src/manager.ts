import { Ber, BerWriter } from 'asn1-ber'
import { Serialize, Api } from '@proton/js';

export default class LedgerDataManager {
	async serialize(chainId: any, transaction: any, _?: any, api?: any): Promise<Buffer> {
		const writer = new BerWriter()

		encode(writer, createNewBuffer(api, 'checksum256', chainId))
		encode(writer, createNewBuffer(api, 'time_point_sec', transaction.expiration))
		encode(writer, createNewBuffer(api, 'uint16', transaction.ref_block_num))
		encode(writer, createNewBuffer(api, 'uint32', transaction.ref_block_prefix))
		encode(writer, createNewBuffer(api, 'varuint32', 0)) // max_net_usage_words
		encode(writer, createNewBuffer(api, 'uint8', transaction.max_cpu_usage_ms))
		encode(writer, createNewBuffer(api, 'varuint32', transaction.delay_sec))

		encode(writer, createNewBuffer(api, 'uint8', 0)) // ctx_free_actions_size

		encode(writer, createNewBuffer(api, 'uint8', transaction.actions.length))
		for (const action of transaction.actions) {
			encode(writer, createNewBuffer(api, 'name', action.account))
			encode(writer, createNewBuffer(api, 'name', action.name))
			encode(writer, createNewBuffer(api, 'uint8', action.authorization.length))

			for (const authorization of action.authorization) {
				encode(writer, createNewBuffer(api, 'name', authorization.actor))
				encode(writer, createNewBuffer(api, 'name', authorization.permission))
			}

			const actionData = Buffer.from(action.data, 'hex')
			encode(writer, createNewBuffer(api, 'varuint32', actionData.length))

			const actionDataBuffer = new Serialize.SerialBuffer()
			actionDataBuffer.pushArray(actionData)
			encode(writer, actionDataBuffer.asUint8Array())
		}

		encode(writer, createNewBuffer(api, 'uint8', 0)) // transaction_extensions
		encode(writer, createNewBuffer(api, 'checksum256', Buffer.alloc(32, 0).toString('hex'))) // ctx_free_data

		return writer.buffer
	}
}

const createNewBuffer = (api: Api, type: string, data: any) => {
  const buffer = new Serialize.SerialBuffer()

  api.serialize(buffer, type, data)
  return buffer.asUint8Array()
}

const encode = (writer: any , buffer: Uint8Array) => {
  writer.writeBuffer(Buffer.from(buffer), Ber.OctetString)
}