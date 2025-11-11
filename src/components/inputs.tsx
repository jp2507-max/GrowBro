import React from 'react';

import type { OptionType } from '@/components/ui';
import { Checkbox, Input, Radio, Select, Switch, View } from '@/components/ui';
import { translate, type TxKeyPath } from '@/lib';

import { Title } from './title';

const options: OptionType[] = [
  { value: 'chocolate', label: 'Chocolate' },
  { value: 'strawberry', label: 'Strawberry' },
  { value: 'vanilla', label: 'Vanilla' },
];

export const Inputs = () => {
  const [value, setValue] = React.useState<string | number | undefined>();
  return (
    <>
      <Title text="Form" />
      <View>
        <Input label="Default" placeholder="Lorem ipsum dolor sit amet" />
        <Input label="Error" error="This is a message error" />
        <Input label="Focused" />
        <Select
          label="Select"
          options={options}
          value={value}
          onSelect={(option) => setValue(option)}
        />
        <CheckboxExample />
        <RadioExample />
        <SwitchExample />
      </View>
    </>
  );
};

const CheckboxExample = () => {
  const [checked, setChecked] = React.useState(false);
  return (
    <Checkbox.Root
      checked={checked}
      onChange={setChecked}
      accessibilityLabel={translate('inputs.accept_terms_label' as TxKeyPath)}
      accessibilityHint={translate('accessibility.common.toggleHint' as any)}
      className="pb-2"
      testID="checkbox-example"
    >
      <Checkbox.Icon checked={checked} />
      <Checkbox.Label text={translate('inputs.checkbox_label' as TxKeyPath)} />
    </Checkbox.Root>
  );
};

const RadioExample = () => {
  const [selected, setSelected] = React.useState(false);
  return (
    <Radio.Root
      checked={selected}
      onChange={setSelected}
      accessibilityLabel="radio button"
      accessibilityHint={translate('accessibility.common.toggleHint' as any)}
      className="pb-2"
    >
      <Radio.Icon checked={selected} />
      <Radio.Label text="radio button" />
    </Radio.Root>
  );
};

const SwitchExample = () => {
  const [active, setActive] = React.useState(false);
  return (
    <Switch.Root
      checked={active}
      onChange={setActive}
      accessibilityLabel={translate('inputs.switch_label' as TxKeyPath)}
      accessibilityHint={translate('accessibility.common.toggleHint' as any)}
      className="pb-2"
    >
      <Switch.Icon checked={active} />
      <Switch.Label text={translate('inputs.switch_label' as TxKeyPath)} />
    </Switch.Root>
  );
};
