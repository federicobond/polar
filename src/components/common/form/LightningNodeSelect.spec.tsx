import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { Form } from 'antd';
import { ipcChannels, withDefaults } from 'shared';
import { LndNodeModel } from 'store/models/lnd';
import { getNetwork } from 'utils/tests';
import LightningNodeSelect, { Props } from './LightningNodeSelect';

describe('LightningNodeSelect', () => {
  const renderComponent = (
    initialNodes?: { [key: string]: LndNodeModel },
    initialValue?: string,
  ) => {
    const network = getNetwork(1, 'test network');
    const nodes = initialNodes || {
      alice: {},
    };
    const FormCmp = Form.create<Props>()(LightningNodeSelect);
    const cmp = (
      <FormCmp
        network={network}
        id="from"
        label="Source"
        nodes={nodes}
        initialValue={initialValue}
      />
    );
    const result = render(cmp);
    return {
      ...result,
      network,
    };
  };

  it('should display the label and input', () => {
    const { getByText, getByLabelText } = renderComponent();
    expect(getByText('Source')).toBeInTheDocument();
    expect(getByLabelText('Source')).toBeInTheDocument();
  });

  it('should display the initial nodes balance', () => {
    const nodes = {
      alice: {
        walletBalance: withDefaults(
          { confirmedBalance: '100' },
          ipcChannels.walletBalance,
        ),
      },
    };
    const { getByText } = renderComponent(nodes, 'alice');
    expect(getByText('Balance: 100 sats')).toBeInTheDocument();
  });

  it('should display the selected nodes balance', async () => {
    const nodes = {
      alice: {
        walletBalance: withDefaults(
          { confirmedBalance: '100' },
          ipcChannels.walletBalance,
        ),
      },
      bob: {
        walletBalance: withDefaults(
          { confirmedBalance: '200' },
          ipcChannels.walletBalance,
        ),
      },
    };
    const { getByText, queryByText, getByLabelText } = renderComponent(nodes, 'alice');
    // confirm the initial balance is displayed
    expect(queryByText('Balance: 100 sats')).toBeInTheDocument();
    // open the dropdown
    fireEvent.click(getByLabelText('Source'));
    // click on bob option
    fireEvent.click(getByText('bob'));
    // confirm the balance updates
    expect(getByText('Balance: 200 sats')).toBeInTheDocument();
  });
});
