import { IChart, IConfig } from '@mrblenny/react-flow-chart';
import {
  defaultChannel,
  defaultInfo,
  defaultPendingChannel,
  defaultPendingOpenChannel,
} from 'shared';
import { LndNodeMapping } from 'store/models/lnd';
import { Network } from 'types';
import { initChartFromNetwork, snap, updateChartFromLnd } from './chart';
import { getNetwork } from './tests';

describe('Chart Util', () => {
  let network: Network;
  let chart: IChart;
  let lndData: LndNodeMapping;

  const addChannel = (node: string, remotePubkey: string, pending?: boolean) => {
    const { channels } = lndData[node];
    if (channels) {
      if (!pending) {
        channels.open.push(
          defaultChannel({
            remotePubkey,
            channelPoint: 'xxxxxxxxxxxxxxxx:0',
            capacity: '1000',
            localBalance: '400',
            remoteBalance: '600',
            initiator: true,
          }),
        );
      } else {
        channels.opening.push(
          defaultPendingOpenChannel({
            channel: defaultPendingChannel({
              remoteNodePub: remotePubkey,
              channelPoint: 'xxxxxxxxxxxxxxxx:0',
              capacity: '1000',
              localBalance: '400',
              remoteBalance: '600',
            }),
          }),
        );
      }
    }
  };

  beforeEach(() => {
    network = getNetwork();
    chart = initChartFromNetwork(network);
    lndData = {
      [network.nodes.lightning[0].name]: {
        info: defaultInfo({ identityPubkey: 'lnd1pubkey' }),
        channels: {
          open: [],
          opening: [],
          closing: [],
          forceClosing: [],
          waitingClose: [],
        },
      },
      [network.nodes.lightning[1].name]: {
        info: defaultInfo({ identityPubkey: 'lnd2pubkey' }),
        channels: {
          open: [],
          opening: [],
          closing: [],
          forceClosing: [],
          waitingClose: [],
        },
      },
    };
  });

  describe('snap', () => {
    it('should snap position to a 20*20 grid', () => {
      const config = { snapToGrid: true } as IConfig;
      expect(snap({ x: 20, y: 20 }, config)).toEqual({ x: 20, y: 20 });
      expect(snap({ x: 21, y: 21 }, config)).toEqual({ x: 20, y: 20 });
      expect(snap({ x: 28, y: 28 }, config)).toEqual({ x: 20, y: 20 });
      expect(snap({ x: 31, y: 31 }, config)).toEqual({ x: 40, y: 40 });
      expect(snap({ x: 35, y: 35 }, config)).toEqual({ x: 40, y: 40 });
    });

    it('should not snap position', () => {
      expect(snap({ x: 20, y: 20 })).toEqual({ x: 20, y: 20 });
      expect(snap({ x: 21, y: 21 })).toEqual({ x: 21, y: 21 });
      expect(snap({ x: 31, y: 31 })).toEqual({ x: 31, y: 31 });
    });
  });

  describe('updateChartFromNetwork', () => {
    it('should create link for an open channel', () => {
      addChannel('alice', 'lnd2pubkey');
      const result = updateChartFromLnd(chart, lndData);
      expect(result.links['xxxxxxxxxx:0']).toBeDefined();
      const link = result.links['xxxxxxxxxx:0'];
      expect(link.from.nodeId).toBe('alice');
      expect(link.to.nodeId).toBe('bob');
      expect(link.properties.type).toBe('open-channel');
      expect(link.properties.status).toBe('Open');
      expect(link.properties.capacity).toBe('1000');
    });

    it('should create link for a pending channel', () => {
      addChannel('alice', 'lnd2pubkey', true);
      const result = updateChartFromLnd(chart, lndData);
      expect(result.links['xxxxxxxxxx:0']).toBeDefined();
      const link = result.links['xxxxxxxxxx:0'];
      expect(link.from.nodeId).toBe('alice');
      expect(link.to.nodeId).toBe('bob');
      expect(link.properties.type).toBe('pending-channel');
      expect(link.properties.status).toBe('Opening');
      expect(link.properties.capacity).toBe('1000');
    });

    it('should remove links for channels that do not exist', () => {
      addChannel('alice', 'lnd2pubkey');
      const result = updateChartFromLnd(chart, lndData);
      expect(result.links['xxxxxxxxxx:0']).toBeTruthy();
      // remove the channel
      const { channels } = lndData['alice'];
      if (channels) channels.open = [];
      const result2 = updateChartFromLnd(result, lndData);
      expect(result2.links['xxxxxxxxxx:0']).toBeUndefined();
    });

    it('should make no changes if channels is undefined', () => {
      lndData['alice'].channels = undefined;
      lndData['bob'].channels = undefined;
      const result = updateChartFromLnd(chart, lndData);
      expect(result).toEqual(chart);
    });

    it('should point link right to left', () => {
      chart.nodes['alice'].position.x = 200;
      chart.nodes['bob'].position.x = 100;
      addChannel('alice', 'lnd2pubkey');
      const result = updateChartFromLnd(chart, lndData);
      const link = result.links['xxxxxxxxxx:0'];
      expect(link.properties.direction).toEqual('rtl');
    });

    it('should update the node sizes', () => {
      chart.nodes['alice'].size = { width: 100, height: 20 };
      chart.nodes['bob'].size = undefined;
      addChannel('alice', 'lnd2pubkey');
      const result = updateChartFromLnd(chart, lndData);
      let size = result.nodes['alice'].size;
      expect(size).toBeDefined();
      if (size) expect(size.height).toBe(60);
      size = result.nodes['bob'].size;
      expect(size).toBeDefined();
      if (size) expect(size.height).toBe(60);
    });
  });
});
