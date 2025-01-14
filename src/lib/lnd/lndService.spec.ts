import { getNetwork } from 'utils/tests';
import lndProxyClient from './lndProxyClient';
import lndService from './lndService';

jest.mock('./lndProxyClient');

describe('LndService', () => {
  const [node, node2] = getNetwork().nodes.lightning;

  it('should get node info', async () => {
    const expected = { identityPubkey: 'asdf' };
    lndProxyClient.getInfo = jest.fn().mockResolvedValue(expected);
    const actual = await lndService.getInfo(node);
    expect(actual).toEqual(expected);
  });

  it('should get wallet balance', async () => {
    const expected = { confirmedBalance: '1000' };
    lndProxyClient.getWalletBalance = jest.fn().mockResolvedValue(expected);
    const actual = await lndService.getWalletBalance(node);
    expect(actual).toEqual(expected);
  });

  it('should get new address', async () => {
    const expected = { address: 'abcdef' };
    lndProxyClient.getNewAddress = jest.fn().mockResolvedValue(expected);
    const actual = await lndService.getNewAddress(node);
    expect(actual).toEqual(expected);
  });

  it('should get list channels', async () => {
    const expected = { channels: [] };
    lndProxyClient.listChannels = jest.fn().mockResolvedValue(expected);
    const actual = await lndService.listChannels(node);
    expect(actual).toEqual(expected);
  });

  it('should get list pending channels', async () => {
    const expected = { pendingOpenChannels: [] };
    lndProxyClient.pendingChannels = jest.fn().mockResolvedValue(expected);
    const actual = await lndService.pendingChannels(node);
    expect(actual).toEqual(expected);
  });

  it('should close the channel', async () => {
    const expected = true;
    lndProxyClient.closeChannel = jest.fn().mockResolvedValue(expected);
    const actual = await lndService.closeChannel(node, 'chanPoint');
    expect(actual).toEqual(expected);
  });

  it('should call onNodesDeleted', async () => {
    const network = getNetwork();
    await lndService.onNodesDeleted(network.nodes.lightning);
    const [n1, n2] = network.nodes.lightning;
    expect(lndProxyClient.onNodesDeleted).toBeCalledWith([n1, n2]);
  });

  describe('openChannel', () => {
    it('should open the channel successfully', async () => {
      lndProxyClient.getInfo = jest.fn().mockResolvedValue({ identityPubkey: 'asdf' });
      lndProxyClient.listPeers = jest.fn().mockResolvedValue({
        peers: [{ pubKey: 'asdf' }],
      });
      const expected = { fundingTxidStr: 'xyz' };
      lndProxyClient.openChannel = jest.fn().mockResolvedValue(expected);
      const actual = await lndService.openChannel(node, node2, '1000');
      expect(actual).toEqual(expected);
      expect(lndProxyClient.getInfo).toBeCalledTimes(1);
      expect(lndProxyClient.listPeers).toBeCalledTimes(1);
      expect(lndProxyClient.connectPeer).toBeCalledTimes(0);
    });

    it('should connect peer then open the channel', async () => {
      lndProxyClient.getInfo = jest.fn().mockResolvedValue({ identityPubkey: 'asdf' });
      lndProxyClient.listPeers = jest.fn().mockResolvedValue({
        peers: [{ pubKey: 'fdsa' }],
      });
      const expected = { fundingTxidStr: 'xyz' };
      lndProxyClient.openChannel = jest.fn().mockResolvedValue(expected);
      const actual = await lndService.openChannel(node, node2, '1000');
      expect(actual).toEqual(expected);
      expect(lndProxyClient.getInfo).toBeCalledTimes(1);
      expect(lndProxyClient.listPeers).toBeCalledTimes(1);
      expect(lndProxyClient.connectPeer).toBeCalledTimes(1);
    });
  });

  describe('waitUntilOnline', () => {
    it('should wait successfully', async () => {
      lndProxyClient.getInfo = jest.fn().mockResolvedValue({});
      await expect(lndService.waitUntilOnline(node)).resolves.not.toThrow();
      expect(lndProxyClient.getInfo).toBeCalledTimes(1);
    });

    it('should throw error if waiting fails', async () => {
      lndProxyClient.getInfo = jest.fn().mockRejectedValue(new Error('test-error'));
      await expect(lndService.waitUntilOnline(node, 0.5, 1)).rejects.toThrow(
        'test-error',
      );
      expect(lndProxyClient.getInfo).toBeCalledTimes(4);
    });
  });
});
