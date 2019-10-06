import { IpcMain } from 'electron';
import { debug } from 'electron-log';
import createLndRpc, * as LND from '@radar/lnrpc';
import { ipcChannels } from '../../src/shared';
import { LndNode } from '../types';
import { DefaultsKey, withDefaults } from './responses';

/**
 * mapping of node name <-> LnRpc to cache these objects. The createLndRpc function
 * reads from disk, so this gives us a small bit of performance improvement
 */
const rpcCache: {
  [key: string]: LND.LnRpc;
} = {};

/**
 * Helper function to lookup a node by name in the cache or create it if
 * it doesn't exist
 */
const getRpc = async (node: LndNode): Promise<LND.LnRpc> => {
  const { name, ports, paths } = node;
  // TODO: use node unique id for caching since is an application level global variable
  if (!rpcCache[name]) {
    const config = {
      server: `127.0.0.1:${ports.grpc}`,
      tls: paths.tlsCert,
      macaroonPath: paths.adminMacaroon,
    };
    rpcCache[name] = await createLndRpc(config);
  }
  return rpcCache[name];
};

const getInfo = async (args: { node: LndNode }): Promise<LND.GetInfoResponse> => {
  const rpc = await getRpc(args.node);
  return await rpc.getInfo();
};

const walletBalance = async (args: {
  node: LndNode;
}): Promise<LND.WalletBalanceResponse> => {
  const rpc = await getRpc(args.node);
  return await rpc.walletBalance();
};

const newAddress = async (args: { node: LndNode }): Promise<LND.NewAddressResponse> => {
  const rpc = await getRpc(args.node);
  return await rpc.newAddress();
};

const listPeers = async (args: { node: LndNode }): Promise<LND.ListPeersResponse> => {
  const rpc = await getRpc(args.node);
  return await rpc.listPeers();
};

const connectPeer = async (args: {
  node: LndNode;
  req: LND.ConnectPeerRequest;
}): Promise<{}> => {
  const rpc = await getRpc(args.node);
  return await rpc.connectPeer(args.req);
};

const openChannel = async (args: {
  node: LndNode;
  req: LND.OpenChannelRequest;
}): Promise<LND.ChannelPoint> => {
  const rpc = await getRpc(args.node);
  return await rpc.openChannelSync(args.req);
};

/**
 * A mapping of electron IPC channel names to the functions to execute when
 * messages are recieved
 */
const listeners: {
  [key: string]: (...args: any) => Promise<any>;
} = {
  [ipcChannels.getInfo]: getInfo,
  [ipcChannels.walletBalance]: walletBalance,
  [ipcChannels.newAddress]: newAddress,
  [ipcChannels.listPeers]: listPeers,
  [ipcChannels.connectPeer]: connectPeer,
  [ipcChannels.openChannel]: openChannel,
};

/**
 * Sets up the IPC listeners for the main process and maps them to async
 * functions.
 * @param ipc the IPC onject of the main process
 */
export const initLndProxy = (ipc: IpcMain) => {
  debug('LndProxyServer: initialize');
  Object.entries(listeners).forEach(([channel, func]) => {
    const reqChan = `lnd-${channel}-request`;
    const resChan = `lnd-${channel}-response`;

    debug(`listening for ipc command "${channel}"`);
    ipc.on(reqChan, async (event, ...args) => {
      // when a message is received by the main process...
      debug(`LndProxyServer: received request "${reqChan}"`, ...args);
      try {
        // attempt to execute the associated function
        let result = await func(...args);
        // merge the result with default values since LND omits falsey values
        debug(`LndProxyServer: send response "${resChan}"`, result);
        result = withDefaults(result, channel as DefaultsKey);
        // response to the calling process with a reply
        event.reply(resChan, result);
      } catch (err) {
        // reply with an error message if the execution fails
        debug(`LndProxyServer: send error "${resChan}"`, err);
        event.reply(resChan, { err: err.message });
      }
    });
  });
};
